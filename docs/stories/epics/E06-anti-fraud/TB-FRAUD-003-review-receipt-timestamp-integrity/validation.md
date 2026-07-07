# Validation

## Proof Strategy

Use unit tests to prove request validation, receipt insert parameter construction, and duplicate hash fraud flag behavior. Use server syntax checks for import/SQL string sanity. When local PostgreSQL is available, run migrations and a transaction-rolled-back insert proof for `receipt_verifications.captured_at`.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Receipt upload insert includes `captured_at`; duplicate hash precheck creates a fraud flag; future review `visitedAt` is rejected before DB connection |
| Integration | Migration adds nullable `receipt_verifications.captured_at`; insert/update proof rolls back without residue when PostgreSQL is available |
| E2E | Not in scope |
| Platform | Not in scope |
| Performance | Not in scope |
| Logs/Audit | Fraud flag insert path remains covered by unit tests |

## Fixtures

- Mocked `pg` clients in unit tests.
- Deterministic UUIDs used by existing review and receipt service tests.
- Existing JPEG magic-byte fixture in `server/tests/unit/receiptService.test.js`.

## Commands

```text
npm --prefix server run test:unit -- tests/unit/reviewService.test.js tests/unit/receiptService.test.js
npm run server:build
npm run db:migrate
npm run harness -- query matrix
```

## Acceptance Evidence

To be filled after verification. If local PostgreSQL or Harness CLI is unavailable, record the blocker instead of claiming proof.
