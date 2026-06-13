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
# DB insert/rollback SQL proof for users
# API smoke commands to be added during implementation
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
