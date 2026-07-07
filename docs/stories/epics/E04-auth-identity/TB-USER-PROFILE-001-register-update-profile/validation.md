# Validation

## Proof Strategy

Prove Cognito identity mapping finds or safely binds the correct local user, profile APIs map fields correctly, invalid input is rejected, and suspended/deleted/active-deletion users cannot mutate profile.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Body validation, field mapping, avatar allowlist validation, active deletion-request mutation guard. |
| Integration | Cognito-sub user mapping; verified-phone transition fallback; unmapped identity rejection; GET me returns profile; PATCH updates display/avatar; SUSPENDED/DELETED update rejected. |
| E2E | Authenticated profile smoke through Cognito bearer token or accepted Cognito-compatible test double. |
| Platform | LocalStack Cognito where available, otherwise explicit Cognito-compatible test double preserving claim semantics. |
| Performance | Not required. |
| Logs/Audit | No full phone/token logging. |

## Fixtures

- Cognito subject with mapped local user.
- Verified-phone transition user with no `cognito_sub`.
- Unmapped Cognito subject.
- Active user.
- Suspended user.
- Deleted user.
- User with active account deletion request.

## Commands

```text
npm run db:migrate
npm run test:unit --prefix server -- tests/unit/config/appConfig.test.js tests/unit/auth/authService.test.js tests/unit/user/userService.test.js
npm run test:integration --prefix server -- tests/integration/userProfile.integration.test.js
npm run server:build
```

## Acceptance Evidence

2026-06-13:

- `npm run test --prefix server` passed with 8 files and 40 tests.
- `npm run test:unit --prefix server -- tests/unit/auth/authService.test.js tests/unit/user/userService.test.js` passed with 4 files and 25 tests, covering Cognito bearer-token handoff to the provider adapter, Cognito subject mapping, phone fallback gate, enabled verified-phone transition binding, unmapped identity rejection, avatar allowlist validation, and active deletion-request mutation guard.
- `npm run test:integration --prefix server -- tests/integration/userProfile.integration.test.js` passed with 3 files and 9 tests because the repo script includes all `tests/integration`; this covers route-level Cognito bearer subject mapping, verified-phone transition fallback binding, unmapped identity rejection, GET/PATCH `/api/v1/users/me`, avatar allowlist rejection, suspended/deleted update rejection, and the existing deletion-request profile mutation block.
- `npm run server:build` passed; syntax check covered 80 files.
- `npm run db:migrate` passed with 0 migrations applied.
- DB transaction smoke inserted and updated a profile row, rolled back, and reported `rollback_residue=0`.

2026-06-13 review fix:

- Added config regression proof that `AUTH_PHONE_FALLBACK_ENABLED` defaults to enabled for local/test transition fallback while explicit `false` still disables it.
- Updated route-level profile integration setup to leave `AUTH_PHONE_FALLBACK_ENABLED` unset, so verified-phone transition binding is proven through the runtime default rather than a test-only forced `true`.

2026-06-13 production fallback fix:

- Added config regression proof that verified-phone transition fallback defaults on only in local development/test, defaults off in production-like environments, still honors explicit production opt-in after backfill proof, and still honors explicit opt-out.
- `npm run test:unit --prefix server -- tests/unit/config/appConfig.test.js` first failed with production default returning `true`, then passed after the default was narrowed to local development/test.
- `npm run test:unit --prefix server -- tests/unit/config/appConfig.test.js tests/unit/auth/authService.test.js` passed with 5 files and 31 tests.
- `npm run test:integration --prefix server -- tests/integration/userProfile.integration.test.js` passed with 3 files and 9 tests, proving the local/test transition route still binds when `AUTH_PHONE_FALLBACK_ENABLED` is unset.
- `npm run test --prefix server` passed with 8 files and 40 tests.
- `npm run server:build` passed; syntax check covered 80 files.
- `npm run db:migrate` passed with 0 migrations applied.
- DB transaction smoke inserted and updated a profile row, rolled back, and reported `rollback_residue=0`.
- `git diff --check` passed with LF/CRLF warnings only.

2026-06-13 hermetic fallback proof fix:

- Updated route-level profile integration setup to keep `AUTH_PHONE_FALLBACK_ENABLED` present but empty before helper/app imports, preventing later `dotenv` helper loads from rehydrating a local `.env` value while still exercising the runtime default path.

2026-06-13 PR #27 review fix:

- Centralized test environment loading in `server/tests/helpers/env.js` and set `AUTH_PHONE_FALLBACK_ENABLED ??= ''` before `dotenv.config()`, so future tests that import DB/HTTP helpers do not silently inherit a local development fallback flag.
- Removed duplicate direct `dotenv.config()` setup from the user profile integration test; it now imports the shared helper once.
- Replaced direct `appConfig.auth.phoneFallbackEnabled` mutation in auth service unit tests with `setPhoneFallbackEnabled()`, which replaces the mocked auth config object for explicit test opt-in/out.
- `npm run test:unit --prefix server -- tests/unit/config/appConfig.test.js tests/unit/auth/authService.test.js` passed with 5 files and 31 tests.
- `npm run test:integration --prefix server -- tests/integration/userProfile.integration.test.js` passed with 3 files and 9 tests.
- `npm run test --prefix server` passed with 8 files and 40 tests.
- `npm run server:build` passed; syntax check covered 80 files.
- `npm run db:migrate` passed with 0 migrations applied.
- `git diff --check` passed with LF/CRLF warnings only.

2026-06-13 PR #27 missing `NODE_ENV` fix:

- Narrowed the verified-phone transition fallback default so it turns on only when `NODE_ENV` is explicitly set to `development` or `test`; if `NODE_ENV` is absent, `env` remains `development` for local defaults but phone fallback stays disabled unless `AUTH_PHONE_FALLBACK_ENABLED=true` explicitly opts in.
- Added config regression proof for an unset `NODE_ENV` to prevent production-like deployments missing `NODE_ENV` from silently enabling phone fallback.
- `npm run test:unit --prefix server -- tests/unit/config/appConfig.test.js tests/unit/auth/authService.test.js` passed with 5 files and 32 tests.
- `npm run test:integration --prefix server -- tests/integration/userProfile.integration.test.js` passed with 3 files and 9 tests.
- `npm run test --prefix server` passed with 8 files and 41 tests.
- `npm run server:build` passed; syntax check covered 80 files.
- `npm run db:migrate` passed with 0 migrations applied.
- `git diff --check` passed with LF/CRLF warnings only.

2026-06-13 PR #27 empty `NODE_ENV` review blocker fix:

- Fixed the follow-up review blocker where `NODE_ENV=''` still fell back to `env='development'` and enabled verified-phone transition fallback by default.
- Added config regression proof for both missing and empty `NODE_ENV`; fallback now defaults on only when the raw `NODE_ENV` value is explicitly `development` or `test`.
- Manual config smoke for `NODE_ENV=''` returned `phoneFallbackEnabled:false` while keeping `env:'development'` for local defaults.
- `npm run test:unit --prefix server -- tests/unit/config/appConfig.test.js tests/unit/auth/authService.test.js` passed with 5 files and 33 tests.
- `npm run test:integration --prefix server -- tests/integration/userProfile.integration.test.js` passed with 3 files and 9 tests after rerunning sequentially; the first parallel run conflicted with another full server test against shared DB fixture rows.
- `npm run test --prefix server` passed with 8 files and 42 tests.
- `npm run server:build` passed; syntax check covered 80 files.
- `npm run db:migrate` passed with 0 migrations applied.
- `git diff --check` passed with LF/CRLF warnings only.

2026-07-08 Phase 2 backend closeout:

- Added a Harness `story verify` command for `TB-USER-PROFILE-001` so the profile story no longer relies on manual matrix notes for repeatable proof.
- The verify command runs `db:migrate`, targeted profile/auth/config/user unit proof, targeted `userProfile.integration.test.js`, and `server:build` from the repository root.
- `npm run harness -- story verify TB-USER-PROFILE-001` passed: `db:migrate` applied 0 migrations; unit proof reported 13 files / 115 tests passed; integration proof reported 5 files passed, 1 skipped, 43 tests passed, 2 skipped; `server:build` passed for 91 files.
- Spreadsheet Phase 2.1 and 2.2 remain satisfied through the accepted Cognito-first boundary, not through backend-owned OTP, access-token, refresh-token, or password-reset APIs. Cognito owns those auth flows; this story covers the TrustBite-local `/users/me` profile boundary after Cognito JWT verification.
