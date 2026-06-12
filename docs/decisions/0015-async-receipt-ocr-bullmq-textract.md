# 0015 Async receipt OCR: BullMQ/ioredis queue, Textract AnalyzeExpense, mock as test double

Date: 2026-06-12

## Status

Accepted

## Context

Task 4.3 needs to OCR uploaded receipts and feed the extracted signals to the
Task 4.4 verification service. Three sub-decisions were required: (1) how to run
OCR asynchronously and reliably, (2) which Textract API to use, and (3) how to
prove the provider path locally given LocalStack's uneven Textract support.

## Decision

1. **Async via BullMQ + ioredis.** Add `bullmq@5.78.0` and `ioredis@5.11.1`
   (exact pins). Redis already runs in docker-compose for OTP/queues. A producer
   `enqueueReceiptOcr(id)` and a `Worker` with `attempts` + exponential `backoff`
   + a per-job timeout run OCR off the request path. The worker is started
   explicitly from `server.js`, never at module import, so tests and the syntax
   check do not open Redis connections.

2. **Textract `AnalyzeExpense`** (not `DetectDocumentText`). AnalyzeExpense
   returns typed receipt fields (`VENDOR_NAME`, `INVOICE_RECEIPT_DATE`,
   `INVOICE_RECEIPT_ID`, `TOTAL`) and structured `LineItemGroups`, so we avoid
   brittle regex parsing of raw text. Add `@aws-sdk/client-textract@^3.0.0` to
   match the existing AWS SDK version convention.

3. **Provider path proven with a mock test double.** Per
   `provider-integrations.md`, the OCR provider is selected by env
   (`OCR_PROVIDER`), with a mock adapter that fails closed outside test/local.
   The pipeline and normalized contract are proven against the deterministic
   mock; the real Textract adapter is wired and syntax-checked but its live
   extraction is not claimed proven here.

4. **Provider/timeout failure → `PENDING_ADMIN_REVIEW`**, never an automatic
   fraud verdict, matching Status_Mapping. Only the exact-file-hash duplicate
   (layer-1 hard rule) creates a fraud flag at the OCR stage.

## Alternatives Considered

1. Synchronous OCR in the upload request — rejected: couples upload latency and
   success to Textract availability.
2. `DetectDocumentText` + custom parsing — rejected: brittle vs AnalyzeExpense's
   typed fields.
3. Claiming LocalStack Textract as provider proof — rejected: community-tier
   AnalyzeExpense coverage is unreliable; a documented test double is the
   sanctioned fallback.
4. A bespoke DB-polling job runner instead of BullMQ — rejected: reinvents
   retry/backoff/visibility that BullMQ provides on the Redis already present.

## Consequences

Positive:

- Uploads return fast; OCR retries/backoff are handled by a mature library.
- Typed Textract fields reduce extraction bugs.
- Env-selected mock keeps tests deterministic and offline.

Tradeoffs:

- Adds two runtime deps and a Redis dependency for the worker.
- Live Textract extraction remains an unproven follow-up.
- Worker lifecycle must be managed in `server.js` (start/stop) outside this story's
  test surface.

## Follow-Up

- Prove real Textract `AnalyzeExpense` extraction against real AWS or a capable
  LocalStack tier.
- Wire `POST /receipts` upload + S3 put + `enqueueReceiptOcr` in a route story.
- Live Redis enqueue→worker round-trip proof in CI.
