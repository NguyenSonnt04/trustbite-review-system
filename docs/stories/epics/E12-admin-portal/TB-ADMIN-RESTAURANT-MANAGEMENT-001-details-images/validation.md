# Validation

## Required Proof

- Unit tests for BFF route allowlisting, multipart limits, MIME/signature validation, signed delivery, provider failures, and storage compensation.
- Integration tests for admin authorization, complete profile/status updates, image upload/replace/primary/remove, deterministic promotion, audit records, idempotency, and transaction rollback without residue.
- `npm run db:migrate`.
- `npm run server:test:unit`.
- `npm run server:test:integration`.
- `npm run server:build`.
- `npm run lint --prefix client`.
- `npm run client:build`.
- Desktop and 390x844 browser smoke for modal editing and image gallery actions.
- `git diff --check`.

## Evidence

- `npm run db:migrate`: passed, current schema confirmed with 0 pending
  migrations.
- `npm run server:test:unit`: passed, 42 files and 397 tests.
- `npm run server:test:integration`: passed, 19 files and 143 tests; 4
  opt-in LocalStack tests skipped.
- Focused restaurant proof: 13 unit tests and 5 DB-backed integration tests
  cover BFF routing, validation, private storage, signed delivery, complete
  profile/status update, audit, upload, replacement, primary selection,
  deterministic promotion, deletion, signed-URL failure recovery, replacement
  cleanup retry, and invalid-image no-residue behavior.
- `npm run server:build`: passed syntax validation for 132 files.
- `npm run lint --prefix client`: passed.
- `npm run client:build`: passed, including the dynamic restaurant BFF route.
- Browser smoke passed against the production standalone client and a
  provider-safe local mock: desktop detail modal, profile update, caption
  update, upload, primary selection, replacement, deletion, and 390x844
  responsive layout with no horizontal body overflow. A final browser pass also
  proved server-side keyword search and navigation from page 1 to page 2 of a
  45-restaurant result set.
- Real AWS/LocalStack object persistence was not exercised in browser smoke;
  provider behavior is covered by mocked storage unit tests and DB integration
  tests.
- Repository-wide `git diff --check` remains blocked by pre-existing unrelated
  mobile manifest/plist trailing whitespace. Restaurant-management files pass
  scoped whitespace checks.
