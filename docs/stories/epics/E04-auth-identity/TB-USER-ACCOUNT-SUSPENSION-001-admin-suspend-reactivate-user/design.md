# Design

## Domain Model

- Account suspension: `users.status = SUSPENDED`.
- Active account: `users.status = ACTIVE`.
- Deleted account: `users.status = DELETED`; not reactivated by suspend/reactivate endpoint.
- Review restriction: `users.review_restricted_until`; separate from suspension.
- User block: `user_blocks`; separate from suspension.
- Audit log: `audit_logs` row for each admin status change.

## Application Flow

Validation order intentionally runs admin tier authorization before target status-specific errors so an `ADMIN` actor cannot infer `SUPER_ADMIN` target account state from error codes. For actors allowed to target the account, account-context errors still return before `reason` input errors. This preserves deterministic business error codes for authorized actors even when the request body also has an invalid reason.

Suspend:

1. Authenticate admin/super admin.
2. Validate request in this order after loading the target row:
   - if actor tier cannot target the account, return `403 INSUFFICIENT_ADMIN_TIER` before status-specific errors;
   - if target user is `DELETED`, return `400 CANNOT_SUSPEND_DELETED_USER`;
   - if actor targets their own account, return `403 CANNOT_SUSPEND_SELF`;
   - if target user is already `SUSPENDED`, return `409 USER_ALREADY_SUSPENDED`;
   - if `reason` is missing or shorter than 10 characters, return `422 ADMIN_REASON_REQUIRED`.
3. In a DB transaction, update user status to `SUSPENDED`, invalidate/revoke local product session or push-token state where applicable, insert audit log.
4. Return user id, status, invalidated local session/token count where applicable, audit log id.

Reactivate:

1. Authenticate admin/super admin.
2. Validate request in this order after loading the target row:
   - if actor tier cannot target the account, return `403 INSUFFICIENT_ADMIN_TIER` before status-specific errors;
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

Uses existing `users`, `user_roles`, `roles`, and `audit_logs`. `user_roles` is the source of truth for product admin roles and tier checks; Cognito groups do not grant `ADMIN` or `SUPER_ADMIN` by default. Existing `user_sessions` may be used only for local product session/device records where applicable; Cognito refresh/session ownership remains with Cognito. No schema fields added in this story.

## UI / Platform Impact

Backend-only.

## Observability

Audit logs are product records and must include actor, target, previous/new status, and reason. Operational logs must not leak token/session values.

## Alternatives Considered

1. Use account deletion to lock account: rejected.
2. Use user block to lock account: rejected.
3. Use only review restriction: rejected because it does not block login/profile/session.
