# Design

## Provider Boundary

OCR extraction lives behind a provider adapter selected at runtime, mirroring the
identity-provider pattern (`getIdentityProvider()` in `services/auth.js`).

- `services/providers/textractProvider.js` — real adapter. Loads the S3 object
  (`@aws-sdk/client-s3` GetObject) and calls Textract `AnalyzeExpense`
  (`@aws-sdk/client-textract`, added pinned). Returns the normalized struct.
- `services/providers/__mocks__/mockOcrProvider.js` — deterministic test/local
  double. Reads a fixture map keyed by the receipt's S3 key (or a per-job
  override the test injects), returns the normalized struct, and **fails closed**
  (throws) when `NODE_ENV` is not `test`/`development` (local).
- `services/providers/index.js` — `getOcrProvider()` returns the mock when
  `OCR_PROVIDER=mock` (allowed only in test/local) else the Textract adapter.

Normalized struct (the only shape `ocrService` consumes):

```js
{
  rawText: string,            // joined text for ocr_text
  restaurantName: string|null,
  receiptTime: Date|null,
  invoiceNo: string|null,
  totalAmount: number|null,
  lineItems: [{ name, quantity, unitPrice, totalPrice }]
}
```

### AnalyzeExpense mapping (decision: AnalyzeExpense over DetectDocumentText)

`AnalyzeExpense` returns `ExpenseDocuments[].SummaryFields` (typed: `VENDOR_NAME`,
`INVOICE_RECEIPT_DATE`, `INVOICE_RECEIPT_ID`, `TOTAL`) and `LineItemGroups`
(per-item `ITEM`, `QUANTITY`, `PRICE`). This is purpose-built for receipts, so we
get structured fields instead of re-parsing raw text. `rawText` is assembled from
the block text for `ocr_text`. Amounts/dates are parsed defensively (provider
output is untrusted): non-numeric totals → null, unparseable dates → null, which
Task 4.4 already scores as "unreadable".

## OCR Service Pipeline (`services/ocrService.js`)

`processReceiptOcr(receiptVerificationId, { provider, now })`:

1. Load receipt `FOR UPDATE`. Validate file format/size from stored metadata
   (`file_url` extension allowlist for Textract-supported receipt formats:
   `jpg`, `jpeg`, `png`, `pdf`, `tif`, `tiff`, plus a size guard if available); invalid →
   `OCR_FAILED` + terminal, no scoring. (File bytes are validated again here from
   the S3 object content-length when the provider loads them.)
2. Set `status = HASH_CHECKING`. Compute SHA-256 over the S3 object bytes.
   Persist `file_hash_sha256` (already set at upload; verified/overwritten here).
3. Layer-1 duplicate (Anti-Fraud §7.1): if another receipt has the same
   `file_hash_sha256` with `status NOT IN ('OCR_FAILED')`, set
   `status = DUPLICATE_DETECTED` then reject:
   - receipt → REJECTED, decision REJECTED, fraud_risk_score 100.
   - `fraud_flags(flag_code='DUPLICATE_RECEIPT_HASH', risk_score=100)` +
     `fraud_flag_entities` (RECEIPT_VERIFICATION, REVIEW[, USER]).
   - review → REJECTED / DUPLICATE_REJECTED / PRIVATE / NONE (same shape as Task
     4.4's duplicate path).
   - audit_logs row. Return (no OCR, no verifyReceipt).
4. Set `status = OCR_PROCESSING`. Call `provider.extract({ fileUrl, ... })`.
5. On success: in one transaction write `ocr_text`, `ocr_restaurant_name`,
   `ocr_similarity` left null (Task 4.4 computes it), `ocr_receipt_time`,
   `ocr_invoice_no`, `ocr_total_amount`, set `status = OCR_SUCCESS`, and insert
   `receipt_line_items` rows. Commit.
6. Call `verifyReceipt(receiptVerificationId)` (Task 4.4) — it runs in its own
   transaction and writes the final decision + review states.
7. On provider error/timeout thrown out of step 4/5: rethrow so the worker's
   retry policy applies. Only after retries are exhausted does the worker call
   `markPendingAdminReview()` (see below).

`markPendingAdminReview(receiptVerificationId, reason)`: sets receipt
`status = PENDING_ADMIN_REVIEW` and review to PENDING_ADMIN_REVIEW /
PRIVATE_UNTIL_DECISION / NONE (Status_Mapping row "OCR timeout/provider error
after retry"), writes an audit_logs row, and creates **no** fraud flag.

Status_Mapping §4.3 receipt states used: `UPLOADED`, `HASH_CHECKING`,
`DUPLICATE_DETECTED`, `OCR_PROCESSING`, `OCR_SUCCESS`, `OCR_FAILED`,
`PENDING_ADMIN_REVIEW`, `REJECTED`. All within the §4.3 enum.

## Queue + Worker (`services/queue/`)

- `config/redis.js` (or `config/ocr.js`) reads `REDIS_HOST`, `REDIS_PORT`,
  `REDIS_PASSWORD`, `REDIS_DB`, and OCR knobs `OCR_QUEUE_NAME`,
  `OCR_JOB_ATTEMPTS` (default 3), `OCR_JOB_BACKOFF_MS` (default 5000, exponential),
  `OCR_JOB_TIMEOUT_MS` (default 30000), `OCR_PROVIDER`. No literals in source.
- `receiptOcrQueue.js` — exports `enqueueReceiptOcr(id)` building a BullMQ `Queue`
  with `{ attempts, backoff: { type: 'exponential', delay }, removeOnComplete }`.
  The ioredis connection uses `{ maxRetriesPerRequest: null }` (BullMQ requirement).
- `receiptOcrWorker.js` — exports a factory `createReceiptOcrWorker({ provider })`
  returning a BullMQ `Worker`. The job processor wraps `processReceiptOcr` in a
  timeout (`Promise.race` against `OCR_JOB_TIMEOUT_MS`). On the **final** failed
  attempt (`job.attemptsMade + 1 >= attempts`), it calls
  `markPendingAdminReview`; transient earlier failures just throw to trigger
  backoff/retry. Worker is started by `server.js` only when OCR is enabled, not at
  import time (so tests/import don't open Redis connections).

The pipeline logic (`processReceiptOcr`, hash dup, line-item writes, timeout
wrapper, terminal-failure branch) is exercised by integration tests against the
mock provider and a real Postgres, calling the processor directly with an
injected provider — independent of a live Redis broker. Live Redis enqueue/worker
round-trip is documented as a separate manual proof.

## Data Model

No schema change. Writes target existing columns on `receipt_verifications`
(`status`, `file_hash_sha256`, `ocr_text`, `ocr_restaurant_name`,
`ocr_receipt_time`, `ocr_invoice_no`, `ocr_total_amount`) and existing tables
`receipt_line_items`, `fraud_flags`, `fraud_flag_entities`, `audit_logs`. The
duplicate hard rule is enforced logically here and backstopped by partial unique
index `idx_receipts_hash_uniq`.

## Boundary Inputs

Provider output is untrusted: amounts coerced via Number with NaN→null, dates via
Date with invalid→null, strings trimmed/null-guarded, line-item quantities
defaulted to 1 and prices ≥0 (schema CHECK). File format/size validated before
any scoring.

## Observability

Audit log records the duplicate rejection and the pending-admin-review outcome
(actor NULL, actor_role `SYSTEM`). `ocr_text` is PII-bearing and is never logged;
the model's `toJSON` already omits it.

## Alternatives Considered

1. `DetectDocumentText` + regex parsing — rejected: receipts are semi-structured;
   `AnalyzeExpense` returns typed summary/line-item fields, far less brittle.
2. Synchronous OCR in the request path — rejected: Textract latency would block
   uploads and couple request success to provider availability.
3. Running the worker at module import — rejected: opens a Redis connection on any
   import (tests, syntax check). Worker is started explicitly from `server.js`.
4. Treating provider failure as fraud — rejected: Status_Mapping mandates
   `PENDING_ADMIN_REVIEW`, not a fraud verdict, for provider/timeout errors.
