# Validation

## Proof Strategy

The story is done only when backend behavior is proven with database-backed
integration tests, provider-boundary unit tests, the full server test suite,
syntax build, and Harness story verification. UI/mobile/admin UI proof is
excluded from this backend closeout.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Review creation validation and merchant self-review rule; receipt upload idempotency, duplicate hash, upload-to-OCR enqueue, durable admin-review degradation on post-commit enqueue failure, no enqueue on replay/failure; S3 upload uses private object input and fails closed without bucket config. |
| Integration | `POST /reviews` auth, success persistence, validation no-write, inactive restaurant rollback; `GET /reviews/:reviewId/status` owner, non-owner, not-found, pending, verified, rejected, reference-only, pending-admin-review; existing PR #36 OCR/verification integration tests. |
| E2E | Not in scope for backend closeout. |
| Platform | `npm run db:migrate`; `npm run server:build`; Harness story verification. |
| Performance | Not required for Phase 4 backend closeout. |
| Logs/Audit | Receipt verification audit rows remain covered by `TB-FRAUD-001` OCR/verification proof. |

## Fixtures

- Test users from `server/tests/helpers/factories/users.js`.
- Test restaurants from `server/tests/helpers/factories/restaurants.js`.
- Test reviews from `server/tests/helpers/factories/reviews.js`.
- Test receipt verification rows from `server/tests/helpers/factories/receipts.js`.
- Mock S3 client in `server/tests/unit/receiptStorageService.test.js`.
- Mock OCR provider and queue tests from `TB-FRAUD-001`.

## Commands

```text
npm run db:migrate
npm run test --prefix server
npm run server:build
npm run harness -- story verify TB-REVIEW-001
npm run harness -- query matrix
```

## Acceptance Evidence

2026-07-08 Phase 4 backend Review & OCR closeout:

- `npm run db:migrate`: passed, applied 0 migrations.
- `npm run test --prefix server`: passed, 31 files passed / 1 skipped and
  308 tests passed / 2 skipped.
- `npm run server:build`: passed, syntax check covered 102 server files.
- `npm run harness -- story verify TB-REVIEW-001`: passed the same
  migrate/test/build chain.
- PR #36 (`TB-FRAUD-001`) was verified merged into `main`; OCR and receipt
  verification services are treated as completed dependencies for this story.

Backend coverage added in this closeout:

- Receipt upload enqueue unit proof.
- Receipt upload post-commit enqueue failure proof: no transaction cleanup after
  commit, durable `PENDING_ADMIN_REVIEW` degradation, and terminal-state replay
  preservation when the degrade update is skipped.
- Review create HTTP integration proof.
- Review status HTTP integration proof.
- S3 private boundary unit proof.

UI/mobile/admin UI tasks 4.6, 4.7, and 4.8 were intentionally excluded.
