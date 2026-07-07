# Validation

## Proof Strategy

Prove authenticated account deletion request creation, duplicate prevention, status lookup, optional cancellation, session/push-token revocation, the current profile mutation guard while a request is active, audit/privacy lifecycle records, and handoff to the deletion/anonymization processing story. Store-compliant web deletion access and mobile entrypoint proof are tracked separately by `TB-PRIVACY-WEB-DELETION-001` and `TB-MOBILE-ACCOUNT-DELETION-001`.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Confirmation text validation, open-request duplicate guard, state transition validation, cancellable/non-cancellable request logic, audit metadata, session/push-token revocation counts, and active-request profile mutation rejection. |
| Integration | Authenticated deletion request creates `account_deletion_requests`, sets `users.deletion_requested_at`, revokes sessions/push tokens; duplicate request returns `DELETION_REQUEST_ALREADY_EXISTS`; status endpoint returns open request; cancellation works only during grace period; protected non-deletion mutations reject while an active deletion request is `REQUESTED`; status/cancel routes keep returning deletion-request contract after processing has set the local user to `DELETED`. Processor completion and `users.deleted_at` proof belong to `TB-PRIVACY-RETENTION-JOB-001`. |
| E2E | Covered by separate mobile/web deletion stories before store submission. |
| Platform | Covered by separate mobile/web deletion stories before store submission. |
| Performance | No dedicated performance proof for this request-lifecycle slice. Batch deletion/anonymization performance belongs to `TB-PRIVACY-RETENTION-JOB-001`. |
| Logs/Audit | Audit/privacy lifecycle records exist; operational logs omit raw tokens, full phone numbers, and unnecessary PII/reasons. |

## Fixtures

- Active user with active sessions and push tokens.
- User with existing open deletion request.
- Deletion request in `REQUESTED`, `PROCESSING`, `COMPLETED`, and `CANCELLED` states.
- User attempting `PATCH /users/me` while an active deletion request exists.

## Commands

```text
npm run test:unit --prefix server -- tests/unit/user/userService.test.js
npm run test --prefix server -- tests/integration/userDeletionRequest.integration.test.js
npm run server:build
npm run db:migrate
# DB insert/rollback SQL proof for account_deletion_requests, users.deletion_requested_at, user_sessions revocation, push_tokens inactivation, and audit lifecycle records
# Deletion/anonymization job smoke command to be added during TB-PRIVACY-RETENTION-JOB-001 implementation
```

## Acceptance Evidence

- `POST /api/v1/users/me/deletion-request`, `GET /api/v1/users/me/deletion-request`, and `POST /api/v1/users/me/deletion-request/cancel` are mounted under authenticated `/api/v1/users`.
- `UserService.createDeletionRequest` validates confirmation text, rejects duplicate `REQUESTED`/`PROCESSING` requests with `DELETION_REQUEST_ALREADY_EXISTS`, creates `account_deletion_requests`, sets `users.deletion_requested_at`, revokes local `user_sessions`, inactivates `push_tokens`, and writes `ACCOUNT_DELETION_REQUESTED` audit metadata without copying the user-provided reason into `audit_logs.reason`.
- `UserService.getOpenDeletionRequest` returns the latest open `REQUESTED`/`PROCESSING` request or `DELETION_REQUEST_NOT_FOUND`.
- `UserService.cancelDeletionRequest` only cancels `REQUESTED` requests, clears `users.deletion_requested_at`, and writes `ACCOUNT_DELETION_CANCELLED` audit metadata.
- `UserService.updateCurrentUser` rejects profile mutations with `DELETION_REQUEST_ACTIVE` while the current user has an active `REQUESTED` or `PROCESSING` deletion request.
- `authMiddleware` maps Cognito/trusted identities before route-aware local status enforcement, rejects protected non-deletion routes with `DELETION_REQUEST_ACTIVE` while `REQUESTED`/`PROCESSING` is open, and allows deletion request status/cancel endpoints to return the deletion lifecycle contract after the processor has set `users.status = DELETED`.
- Deletion/anonymization processing proof is recorded in `TB-PRIVACY-RETENTION-JOB-001`; public web deletion and mobile entrypoint proof remain planned under their separate stories.
- Scoped re-check on 2026-06-13: `npm run test:unit --prefix server -- tests/unit/user/userService.test.js` passed with 18 tests on the clean PR branch; `npm run test --prefix server -- tests/integration/userDeletionRequest.integration.test.js` passed with 1 route-level API lifecycle test; `npm run server:build`; `npm run db:migrate`; `git diff --check`.
- `npm run db:migrate` reported 0 newly applied migrations against the local PostgreSQL environment. Full `npm run server:test` was not rerun during this scope-cleanup pass because the slice added a focused route-level integration proof.
- 2026-07-07 review follow-up: targeted API regression first failed because `POST /api/v1/restaurants` returned `201` while a `REQUESTED` deletion request was open and because `GET /api/v1/users/me/deletion-request` returned `403 ACCOUNT_DELETED` after a simulated processor claim. After the route-aware auth guard fix, `npm run test:integration --prefix server -- tests/integration/userDeletionRequest.integration.test.js` passed with 5 integration files / 36 tests and 1 skipped file / 2 skipped tests; `npm run test:unit --prefix server -- tests/unit/auth/authService.test.js tests/unit/user/userService.test.js` passed with 10 unit files / 96 tests; `npm run server:test` passed with 15 files / 132 tests and 1 skipped file / 2 skipped tests; `npm run server:build` passed with 85-file syntax proof; `npm run db:migrate` applied 0 migrations; `npm run harness -- story verify TB-PRIVACY-DELETION-001` passed after adding the focused verify command for this story.
- 2026-07-07 review follow-up for trailing-slash lifecycle paths: added regression proof that `GET /api/v1/users/me/deletion-request/` and `POST /api/v1/users/me/deletion-request/cancel/` keep the deletion lifecycle contract after processing has set `users.status = DELETED`; `authMiddleware` now normalizes trailing slashes before matching lifecycle exemptions. Sequential proof passed: `npm run test:integration --prefix server -- tests/integration/userDeletionRequest.integration.test.js tests/integration/accountDeletionProcessor.integration.test.js` with 5 integration files / 36 tests and 1 skipped file / 2 skipped tests; `npm run db:migrate` applied 0 migrations; `npm run server:test` passed with 15 files / 132 tests and 1 skipped file / 2 skipped tests; `npm run harness -- story verify TB-PRIVACY-DELETION-001` passed with 10 unit files / 96 tests, 5 integration files / 36 tests, and 85-file syntax proof.
