# Validation

## Proof Strategy

Prove admin authorization, status transitions, session revocation, audit log writes, and suspended-user rejection across auth/profile/protected mutation boundaries.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Status transition validation, self-suspend guard, self-reactivate guard, deleted-user reactivation guard, and reactivate validation order (`DELETED` before not-`SUSPENDED`). |
| Integration | Admin suspends active user; sessions revoked; audit log inserted; suspended user cannot login/refresh/update profile; admin reactivates user; old session remains revoked. |
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
# DB insert/rollback SQL proof for users, user_roles, user_sessions, audit_logs
# API smoke commands to be added during implementation
```

## Acceptance Evidence

TBD after implementation.
