# Validation

## Strategy

TDD with the mock provider. Pipeline logic is integration-tested against a real
local Postgres (factories seed user/restaurant/review/receipt), calling
`processReceiptOcr` / the worker processor directly with an injected mock
provider — no live Redis required for these assertions. Pure helpers
(file-format/size validation, AnalyzeExpense→struct mapping) are unit-tested.
Negative/abuse cases are required.

## Prerequisite fix

Vitest currently does not load `.env`, so `config/app.js` throws at import and
**no** integration test can run (including the pre-existing health test). This
story adds `server/vitest.config.js` + `server/vitest.setup.js` that load dotenv
and force `NODE_ENV=test`. Proof: `npm run test:integration` runs the health test
green after the fix.

## Unit

`tests/unit/receipt/textractMapping.test.js`:
- AnalyzeExpense sample → normalized struct (vendor, date, id, total, line items).
- Missing summary fields → nulls (unreadable), empty line items → `[]`.
- Non-numeric total → null; unparseable date → null.

`tests/unit/receipt/ocrFileValidation.test.js`:
- allowed extensions/mime + size within limit → ok.
- bad extension / oversize → rejected.

`tests/unit/receipt/ocrProviderSelection.test.js`:
- `OCR_PROVIDER=mock` in test → mock; mock throws when `NODE_ENV=production`.

## Integration (mock provider, real Postgres)

`tests/integration/receiptOcr.integration.test.js`:
- merchant match 80–100% → `OCR_SUCCESS` then VERIFIED (via verifyReceipt).
- merchant 60–79% → OCR_SUCCESS then PENDING_ADMIN_REVIEW band.
- merchant <60% → OCR_SUCCESS then REFERENCE_ONLY band.
- merchant unreadable (null vendor) → OCR_SUCCESS, scored unreadable.
- receipt within 48h / 49–168h / >168h → correct downstream bucket.
- duplicate file hash → `DUPLICATE_DETECTED`→REJECTED, `DUPLICATE_RECEIPT_HASH`
  flag + entities, review DUPLICATE_REJECTED, no OCR call made.
- OCR provider timeout (mock delays past `OCR_JOB_TIMEOUT_MS`) on final attempt →
  `PENDING_ADMIN_REVIEW`, no fraud flag.
- OCR provider timeout while file loading is still in flight on final attempt →
  `PENDING_ADMIN_REVIEW`, and the orphaned continuation must not enter
  `HASH_CHECKING`, OCR, or downstream scoring.
- An orphaned file-load continuation that observes `OCR_SUCCESS` from another
  attempt resumes verification and must not re-enter hash-check or OCR.
- provider error after retries → `PENDING_ADMIN_REVIEW`.
- bad file format/size → `OCR_FAILED` before any scoring; no verifyReceipt call.
- line items persisted to `receipt_line_items` with quantity/price.
- status sequence asserted: HASH_CHECKING → OCR_PROCESSING → OCR_SUCCESS.

## Commands

- `npm run test:integration` — must pass (requires local Postgres up + migrated).
- `npm run test:unit` — must pass.
- `npm run server:build` — syntax check.

## DB Proof

Integration tests run real inserts/updates and clean up via `deleteByIds`.
Duplicate-flag and pending-admin paths assert row state then remove seeded rows;
a no-residue check confirms cleanup. Requires `npm run docker:up` +
`npm run db:migrate`. No new migration introduced.

## Provider Proof

Per `provider-integrations.md`, this story records the OCR path as a **test
double (mock provider)**. LocalStack lists `textract` in `SERVICES`, but its
`AnalyzeExpense` coverage is unreliable/community-tier; the normalized contract
and pipeline are proven against the deterministic mock. The real Textract adapter
is wired and syntax-checked but its live extraction is **not** claimed as proven
here — a real-AWS or LocalStack `AnalyzeExpense` round-trip is a follow-up proof.
Config keys required: `AWS_REGION`, credentials, `AWS_S3_BUCKET_NAME`,
`OCR_PROVIDER`, `REDIS_*`, `OCR_JOB_*`. Deployment differs from local proof by
using real Textract + real Redis.

## Result

PASS (2026-06-12).

- `npm run test:unit` — 93/93 green (added: `ocrMapping.test.js`,
  `ocrProviderSelection.test.js`).
- `npm run test:integration` — 14/14 green against local Postgres
  (`receiptOcr.integration.test.js` 9, `receiptOcrWorker.integration.test.js` 4,
  plus the now-unblocked health test).
- `npm run server:build` — syntax check passed for 91 files.

Vitest prerequisite fix confirmed: `vitest.config.js` + `vitest.setup.js` load
dotenv and force `NODE_ENV=test`; the previously-unrunnable health integration
test now passes.

Band calibration verified empirically (Levenshtein vs "Highlands Coffee"):
exact=100→VERIFIED, "Highland Cafe"=75→+25→VERIFIED, null vendor→+50→PENDING,
"Coffee Shop XYZ"=6 + GPS accuracy>100 → +75 → REFERENCE_ONLY, receipt 100h→+40→PENDING.

### Live queue + DB proof (throwaway scripts, removed after running)

- BullMQ enqueue → real Redis → real Worker → OCR (mock) → persist line item →
  `verifyReceipt` → receipt VERIFIED. Confirmed the producer/worker wiring and
  graceful shutdown against the docker-compose Redis.
- Duplicate-hash, pending-admin, and decision writes verified inside transactions;
  cleanup left zero residue (users/receipts/fraud_flags = 0/0/0).

## Provider Proof — recorded

OCR extraction is proven with the **mock provider (test double)**, per
`provider-integrations.md`. The real Textract `AnalyzeExpense` adapter is wired
and syntax-checked; its live extraction is **not** claimed proven here (follow-up:
real AWS or capable LocalStack tier). Config keys required: `AWS_REGION`,
`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET_NAME`, `OCR_PROVIDER`,
`REDIS_HOST/PORT/PASSWORD/DB`, `OCR_QUEUE_NAME`, `OCR_JOB_ATTEMPTS/BACKOFF_MS/TIMEOUT_MS`,
`OCR_MAX_FILE_BYTES`, `OCR_ALLOWED_EXTENSIONS`. Deployment differs from local proof
by using real Textract + real Redis; `AWS_ENDPOINT_URL` may point clients at
LocalStack locally.
