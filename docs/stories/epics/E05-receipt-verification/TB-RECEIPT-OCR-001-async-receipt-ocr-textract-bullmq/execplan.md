# Exec Plan

Story: TB-RECEIPT-OCR-001 — Async receipt OCR service via Textract + BullMQ (Task 4.3)
Lane: high-risk
Epic: E05 Receipt Verification

## Goal

Process an uploaded receipt asynchronously: compute its SHA-256 file hash and
reject layer-1 duplicates, run AWS Textract `AnalyzeExpense` to extract merchant
name, receipt time, invoice number, total amount, and line items, persist those
to `receipt_verifications` + `receipt_line_items`, then hand off to Task 4.4's
`verifyReceipt()` for the fraud decision. The OCR runs on a BullMQ worker with
bounded retries, backoff, and a per-job timeout. Provider failure after retries
parks the receipt at `PENDING_ADMIN_REVIEW` (never an automatic fraud verdict).

## Scope

In scope:

- Textract provider adapter (`AnalyzeExpense`) behind a service boundary,
  loading the object from S3; returns a normalized struct.
- Mock provider that fails closed outside test/local, selected via env (mirrors
  the identity-provider selection pattern).
- `ocrService` pipeline writing the exact `receipt_verifications.status`
  sequence from Status_Mapping §4.3, with the layer-1 file-hash duplicate hard
  rule (+ `DUPLICATE_RECEIPT_HASH` fraud flag) before OCR.
- BullMQ queue producer + worker with attempts/backoff/timeout; terminal failure
  → `PENDING_ADMIN_REVIEW`.
- Pinned `bullmq` + `ioredis` deps; Redis + OCR config via env.
- Vitest setup that loads dotenv + forces `NODE_ENV=test` (unblocks integration
  tests — currently config/app.js throws at import without env).
- Integration tests (mock provider) covering merchant-match bands, receipt-age
  bands, duplicate hash, OCR timeout/failure, and pre-scoring file rejection.

Out of scope:

- The `POST /receipts` upload/S3-put HTTP route (separate route-wiring story);
  this story exposes `enqueueReceiptOcr()` + the worker, tested directly.
- Real Textract response-shape edge cases beyond the documented fields.
- Image-metadata/EXIF editing signals (Anti-Fraud §8 — future).
- Running a live Redis-backed worker in CI (worker logic unit/integration-tested
  with the queue in a deterministic mode; live Redis proof documented).

## Risk Classification

Risk flags: External systems (Textract, S3, Redis), Data model (writes
receipt_verifications + receipt_line_items + fraud_flags), Audit/security
(duplicate fraud flag), Anti-fraud rules, Existing behavior (review lifecycle via
verifyReceipt), Multi-domain.

Hard gates: External provider behavior; audit/security. → high-risk.

## Work Phases

1. Discovery — schema, spec §3/§7, Status_Mapping §4.3, provider-integrations,
   cognito/auth provider-selection pattern, aws config, docker-compose. (done)
2. Design — pipeline, provider boundary, queue/worker, threshold reuse. (this packet)
3. Validation planning — see validation.md.
4. Implementation — deps + config + vitest setup; providers; ocrService; queue/worker. TDD.
5. Verification — test:integration, test:unit, server:build; DB + provider proof.
6. Harness update — intake + story + decision.

## Stop Conditions

Pause for human confirmation if:

- A normalized OCR field needs a column absent from `001_init_schema.sql`.
- Status_Mapping §4.3 requires a status value outside the §4.3 enum list.
- LocalStack Textract proves insufficient AND a real-AWS credential would be
  required to claim provider proof (fall back to documented test double instead).
