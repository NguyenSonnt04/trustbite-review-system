# Validation

## Proof Strategy

Prove admin authorization, status transitions, audit log writes, local product session/token invalidation where applicable, and suspended-user rejection across profile/protected mutation boundaries even when a Cognito token remains otherwise valid.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Status transition validation, self-suspend guard, self-reactivate guard, deleted-user suspend/reactivation guards, admin tier check uses normalized `user_roles` and runs before target status-specific errors, suspend validation order for authorized actors (`DELETED` before self before already-`SUSPENDED` before reason), and reactivate validation order for authorized actors (`DELETED` before self before not-`SUSPENDED` before reason). |
| Integration | Admin suspends active user using TrustBite-local `user_roles`; Cognito groups alone do not grant admin actions; local session/token state invalidated where applicable; audit log inserted; suspended user cannot update profile or perform protected mutations with an otherwise valid Cognito token; admin reactivates user; old local blocked session/token state is not restored. |
| E2E | API smoke through admin bearer token. |
| Platform | None beyond local DB. |
| Performance | Not required. |
| Logs/Audit | Audit row contains reason and previous/new status; operational logs omit tokens. |

## Fixtures

- Admin user with role.
- Super admin user with role.
- Active target user with active sessions.
- Suspended target user.
- Deleted target user.

## Commands

```text
npm run db:migrate
# DB insert/rollback SQL proof for users, user_roles, audit_logs, and local session/token invalidation tables where applicable
# API smoke commands to be added during implementation
```

## Acceptance Evidence

2026-06-13:

- Added unit proof in `server/tests/unit/user/userService.test.js` for admin suspend/reactivate transitions, audit writes, session revocation on suspend, non-admin rejection, admin-tier ordering, deleted/self/status/reason validation ordering, and no session restoration during reactivate.
- Added route-level integration proof file `server/tests/integration/adminUserSuspension.integration.test.js` covering local `user_roles` admin authorization, Cognito provider-group-only denial, suspend side effects, suspended profile mutation rejection, reactivation, admin tier guard, deleted/self/reason guards. Review follow-up fixed role fixture handling so tests no longer update existing canonical `roles` rows and clean up roles they create when no `user_roles` references remain. Second review follow-up added positive `SUPER_ADMIN` proof against an `ADMIN` target and a suspended-user profile mutation rejection using an otherwise accepted Cognito bearer identity.
- `npm run docker:up` passed after Docker Desktop was started: PostgreSQL, Redis, pgAdmin, and LocalStack containers running/started.
- `npm run db:migrate` passed: migration runner skipped existing migrations and applied 0 new migrations.
- `npm run test:unit --prefix server -- tests/unit/user/userService.test.js` passed: Vitest reported 5 unit files / 45 tests passed because the package script includes `tests/unit` plus the supplied path.
- `npm run test:integration --prefix server -- tests/integration/adminUserSuspension.integration.test.js` passed after the second review follow-up: Vitest reported 4 integration files / 13 tests passed because the package script includes `tests/integration` plus the supplied path.
- `npm run test --prefix server` passed after the second review follow-up: Vitest reported 9 test files / 58 tests passed.
- `npm run server:build` passed: syntax check passed for 80 files.
- `npm run harness -- query matrix` passed before final Harness row update.
- `git diff --check` returned only the existing LF/CRLF warning for this story execplan.

Harness row can be marked `implemented` with unit and integration proof. Platform proof is not applicable beyond the local DB migration/integration pass for this story.
