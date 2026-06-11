# Validation

## Proof Strategy

Prove admin authorization, status transitions, audit log writes, local product session/token invalidation where applicable, and suspended-user rejection across profile/protected mutation boundaries even when a Cognito token remains otherwise valid.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Status transition validation, self-suspend guard, self-reactivate guard, deleted-user suspend/reactivation guards, suspend validation order (`DELETED` before self before already-`SUSPENDED` before reason), and reactivate validation order (`DELETED` before self before not-`SUSPENDED` before reason). |
| Integration | Admin suspends active user; local session/token state invalidated where applicable; audit log inserted; suspended user cannot update profile or perform protected mutations with an otherwise valid Cognito token; admin reactivates user; old local blocked session/token state is not restored. |
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

TBD after implementation.
