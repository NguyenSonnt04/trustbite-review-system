# Overview

## Current Behavior

Receipt upload accepts optional `capturedAt` metadata and includes it in the idempotency request hash, but the receipt verification record does not persist the captured timestamp. Review creation accepts a `visitedAt` timestamp but does not reject a timestamp in the future.

Duplicate receipt detection uses the `receipt_verifications.file_hash_sha256` uniqueness policy to prevent reuse of non-failed receipt images and raise a duplicate-hash fraud flag.

## Target Behavior

Receipt upload persists client-supplied `capturedAt` as nullable receipt evidence in `receipt_verifications.captured_at` while still including it in the idempotency request hash. The value is metadata/evidence only and must not reduce fraud risk by itself.

Review creation rejects future `visitedAt` values before opening a database transaction.

Duplicate receipt hash behavior remains aligned with the existing partial unique index `idx_receipts_hash_uniq` and is covered by unit tests.

## Affected Users

- Reviewers uploading receipt evidence.
- Backend developers maintaining receipt/review validation.
- Fraud-review operators relying on timestamp and duplicate-hash evidence.

## Affected Product Docs

- `docs/product/verification.md`
- `docs/ARCHITECTURE.md`
- `server/migrations/`

## Non-Goals

- No OCR/Textract processing implementation.
- No trust-score mutation.
- No receipt polling/status API changes.
- No change to the duplicate-hash uniqueness predicate.
