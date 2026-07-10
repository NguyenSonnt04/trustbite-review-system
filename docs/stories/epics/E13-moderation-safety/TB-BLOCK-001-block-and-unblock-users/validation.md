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
| Unit | insert-new-block, reactivate-soft-deleted, self-block (400), invalid UUID (422), reasonCode too long (422), invalid sourceReviewId (422), target not found (404), already-blocked (409), unique-violation race maps to 409, unblock success, unblock-not-found (404), unblock invalid UUID (422) |
| Integration | block persists a single active row, self-block (400) writes no row, duplicate active block (409), unblock soft-deletes then re-block reactivates the same row, unblock without active block (404), block non-existent target (404), suspended actor rejected (403) with no write |
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

- `npm run server:test:unit` — 297 passed (29 files); includes
  `tests/unit/user/userBlockService.test.js` 12/12.
- `npx vitest run tests/integration/userBlock.integration.test.js` — 7/7 passed
  against live PostgreSQL (`trustbite-postgres` container healthy, 2026-07-10).
  Real inserts/soft-deletes/reactivation proven; rejected paths (400/403/404/409)
  leave the correct row count (0 or single row) with no residue. Each case cleans
  up its rows in `afterEach`.
- Full integration suite — 113 passed, LocalStack-dependent suites skipped.
- `npm run server:build` — syntax check passed for 114 files.

## Notes

- Harness is tracked in the local, git-ignored `harness.db`; register with
  `npm run harness -- story add` / `story update` in the local environment. The
  committed source of truth for this story is this packet under `docs/stories/`.
