# Validation

## Proof Strategy

Report creation is high-risk (authorization + public contract + persistence + a
seed data migration). Proof covers the happy path plus abuse/negative paths, and
shows real rows are written with no residue on rejected paths. Migration `008` is
idempotent seed data (no schema change); its rollback is documented in the file.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit (boundary, `moderationController.test.js`) | valid parse + normalization, blank/absent description → null, non-object body (422), invalid entityType (422), invalid entityId (422), missing reasonCode (422), reasonCode too long (422), non-string description (422), description too long (422) |
| Unit (service, `moderationService.test.js`) | insert SUBMITTED report, self-report USER (422), self-report own REVIEW (422), unknown reason code (422), reason/entity type mismatch (422), non-existent entity (422), duplicate open report (409), unique-violation race → 409, ROLLBACK failure does not mask original error |
| Integration | create SUBMITTED review report (persisted), create user report, duplicate open report (409) keeps a single row, unknown reason code (422), reason/entity mismatch (422), self-report own review (422), non-existent entity (422), self-report USER (422), unauthenticated request (401) with no write, suspended actor (403) with no write |
| E2E | Deferred (no web/mobile report UI in this slice) |
| Platform | N/A |
| Logs/Audit | No moderation_actions/audit_logs write on submission (admin actions belong to task 6.4) |

## Fixtures

- `createUser`, `createRestaurant`, `createReview` factories.
- Reason codes `SPAM_OR_FAKE` (REVIEW) and `ABUSIVE_BEHAVIOR` (USER) seeded
  idempotently in the integration `beforeAll` (independent of migration 008).
- Trusted-local auth header path (`x-trustbite-user-id`).

## Commands

```bash
npm run db:migrate
npm run server:test:unit
npm run server:test:integration -- tests/integration/moderationReport.integration.test.js
npm run server:build
```

## Acceptance Evidence

- `npm run db:migrate` — applied `008_seed_report_reason_codes.sql` (1 migration),
  earlier migrations skipped (idempotent tracking), 2026-07-10, live
  `trustbite-postgres` container.
- `npm run server:test:unit` — 321 passed (32 files); includes
  `tests/unit/moderation/moderationController.test.js` and
  `tests/unit/moderation/moderationService.test.js`.
- `npx vitest run tests/integration/moderationReport.integration.test.js` — 10/10
  passed against live PostgreSQL. Real inserts proven; rejected paths
  (401/403/409/422) leave the correct row count with no residue (each case cleans
  up in `afterEach`).
- Full integration suite — 124 passed, LocalStack-dependent suites skipped.
- `npm run server:build` — syntax check passed for 118 files.

## Notes

- Reason-code catalog is provisional (decision 0020); Product/Ops finalize it.
- `admin_queues` population and admin triage are deferred to task 6.4.
