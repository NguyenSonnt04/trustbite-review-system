# Validation

## Proof Strategy

Block/unblock is high-risk (authorization + public contract + persistence). Proof
must cover the happy path plus abuse/negative paths, and must show real rows are
written/soft-deleted/reactivated with no residue on rejected paths. No schema
change is introduced, so migration proof is not required (the table already
exists in `001_init_schema.sql`).

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit (boundary, `userBlockController.test.js`) | valid parse + normalization, empty/missing body defaults, blank reasonCode → null, invalid UUID (422), reasonCode too long (422), non-string reasonCode (422), invalid sourceReviewId (422), non-object body (422) |
| Unit (service, `userBlockService.test.js`) | insert-new-block, reactivate-soft-deleted, self-block (400), target not found (404), already-blocked (409), unique-violation race maps to 409, unblock success, unblock-not-found (404), unblock DB error mapped (not bare 500), ROLLBACK failure does not mask original error |
| Integration | block persists a single active row, self-block (400) writes no row, duplicate active block (409), unblock soft-deletes then re-block reactivates the same row, unblock without active block (404), block non-existent target (404), non-UUID target rejected at boundary (422), suspended actor rejected (403) with no write |
| E2E | Deferred (no web/mobile block UI in this slice) |
| Platform | N/A |
| Logs/Audit | No audit_logs write by design (user-to-user block, not admin action) |

## Fixtures

- `createUser` factory (`tests/helpers/factories/users.js`) for blocker/target.
- Trusted-local auth header path (`x-trustbite-user-id`,
  `TRUSTBITE_TRUSTED_AUTH_HEADERS=true`) for authenticated requests.

## Commands

```bash
npm run server:test:unit
npm run server:test:integration -- tests/integration/userBlock.integration.test.js
npm run server:build
```

## Acceptance Evidence

- `npm run server:test:unit` — 303 passed (30 files); includes
  `tests/unit/user/userBlockController.test.js` (boundary validation) and
  `tests/unit/user/userBlockService.test.js` (business rules + persistence,
  incl. ROLLBACK-does-not-mask-original-error).
- `npx vitest run tests/integration/userBlock.integration.test.js` — 8/8 passed
  against live PostgreSQL (`trustbite-postgres` container healthy, 2026-07-10).
  Real inserts/soft-deletes/reactivation proven; rejected paths
  (400/403/404/409/422) leave the correct row count (0 or single row) with no
  residue. Each case cleans up its rows in `afterEach`.
- `npm run server:build` — syntax check passed for 115 files.

## Notes

- Harness is tracked in the local, git-ignored `harness.db`; register with
  `npm run harness -- story add` / `story update` in the local environment. The
  committed source of truth for this story is this packet under `docs/stories/`.
