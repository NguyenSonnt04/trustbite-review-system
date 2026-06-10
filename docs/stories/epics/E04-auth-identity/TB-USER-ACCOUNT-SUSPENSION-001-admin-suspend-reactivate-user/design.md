# Design

## Domain Model

- Account suspension: `users.status = SUSPENDED`.
- Active account: `users.status = ACTIVE`.
- Deleted account: `users.status = DELETED`; not reactivated by suspend/reactivate endpoint.
- Review restriction: `users.review_restricted_until`; separate from suspension.
- User block: `user_blocks`; separate from suspension.
- Audit log: `audit_logs` row for each admin status change.

## Application Flow

Suspend:

1. Authenticate admin/super admin.
2. Validate request in this order:
   - if target user is `DELETED`, return `400 CANNOT_SUSPEND_DELETED_USER`;
   - if actor targets their own account, return `403 CANNOT_SUSPEND_SELF`;
   - if target user is already `SUSPENDED`, return `409 USER_ALREADY_SUSPENDED`;
   - if `reason` is missing or shorter than 10 characters, return `422 ADMIN_REASON_REQUIRED`.
3. In a DB transaction, update user status to `SUSPENDED`, revoke active `user_sessions`, insert audit log.
4. Return user id, status, revoked session count, audit log id.

Reactivate:

1. Authenticate admin/super admin.
2. Validate request in this order:
   - if target user is `DELETED`, return `400 CANNOT_REACTIVATE_DELETED_USER`;
   - if actor targets their own account, return `403 CANNOT_REACTIVATE_SELF`;
   - if target user is not `SUSPENDED`, return `409 USER_NOT_SUSPENDED`;
   - if `reason` is missing or shorter than 10 characters, return `422 ADMIN_REASON_REQUIRED`.
3. In a DB transaction, update user status to `ACTIVE`, insert audit log.
4. Return user id, status, audit log id.

## Interface Contract

- `POST /api/v1/admin/users/{userId}/suspend`.
- `POST /api/v1/admin/users/{userId}/reactivate`.

## Data Model

Uses existing `users`, `user_sessions`, `user_roles`, `roles`, and `audit_logs`. No schema fields added.

## UI / Platform Impact

Backend-only.

## Observability

Audit logs are product records and must include actor, target, previous/new status, and reason. Operational logs must not leak token/session values.

## Alternatives Considered

1. Use account deletion to lock account: rejected.
2. Use user block to lock account: rejected.
3. Use only review restriction: rejected because it does not block login/profile/session.
