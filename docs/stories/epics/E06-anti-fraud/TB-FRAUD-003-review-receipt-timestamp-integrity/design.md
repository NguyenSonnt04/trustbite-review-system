# Design

## Domain Model

- Review `visitedAt`: the user-declared restaurant visit timestamp. It is optional, but if supplied it must be a valid ISO-8601 datetime and must not be in the future.
- Receipt `capturedAt`: optional client-supplied image capture metadata. It is persisted for evidence/idempotency traceability, but it is not trusted as a fraud-reducing signal by itself.
- Duplicate receipt hash: a receipt file SHA-256 that already exists in a non-`OCR_FAILED` receipt verification is a duplicate and creates a `DUPLICATE_RECEIPT_HASH` fraud flag.

## Application Flow

1. Review creation parses and validates `visitedAt` in `reviewService` before opening a transaction.
2. Receipt upload validates file and fields, computes `file_hash_sha256`, and builds a stable idempotency request hash including `capturedAt`.
3. Receipt upload checks for an existing active receipt hash before inserting.
4. Receipt upload inserts the receipt verification with GPS metadata and nullable `captured_at`.
5. Duplicate hash rejection persists a fraud flag linked to the existing receipt and attempted user.

## Interface Contract

- `POST /reviews` rejects future `visitedAt` with `422 VALIDATION_ERROR`.
- `POST /receipts` continues accepting optional `capturedAt` as an ISO-8601 datetime.
- Same idempotency key plus different `capturedAt` remains an idempotency conflict through the existing request hash behavior.
- Duplicate receipt hash remains `409 DUPLICATE_RECEIPT_HASH`.

## Data Model

- Add `receipt_verifications.captured_at TIMESTAMPTZ NULL`.
- Keep existing unique index `idx_receipts_hash_uniq` unchanged:
  - `file_hash_sha256`
  - partial predicate `status NOT IN ('OCR_FAILED')`

## UI / Platform Impact

No client/mobile UI change is required in this story. Existing clients may continue to send `capturedAt`; backend now persists it.

## Observability

No new audit log or operational log is added. Validation failures and duplicate hash conflicts continue through existing error handling.

## Alternatives Considered

1. Drop `capturedAt` from request hashing because it was not persisted. Rejected because the API already accepts it and retries should remain payload-stable.
2. Store `capturedAt` in `ocr_receipt_time`. Rejected because OCR receipt time is provider-derived transaction time, not client capture metadata.
3. Change duplicate hash classification to avoid the index name entirely. Deferred; this fix makes the current index constant explicit and verifies the schema-defined name while preserving existing race handling.
