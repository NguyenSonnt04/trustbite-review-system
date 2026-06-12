# Exec Plan

## Goal

Implement backend admin account suspension/reactivation while keeping review restriction, user block/unblock, and account deletion as separate concepts.

## Scope

In scope:

- `POST /api/v1/admin/users/{userId}/suspend`.
- `POST /api/v1/admin/users/{userId}/reactivate`.
- `users.status` transitions between `ACTIVE` and `SUSPENDED`.
- Local account-state enforcement on suspend.
- Audit log entries with actor/reason/previous/new status.
- Auth middleware/service checks that block suspended users from profile mutation and future protected mutations even if a Cognito token remains valid until expiry.

Out of scope:

- Account deletion/data anonymization.
- User-to-user block/unblock implementation unless a separate safety story selects it.
- Review-only restriction implementation beyond preserving `review_restricted_until` semantics.
- UI/admin web.

## Risk Classification

Risk flags:

- Auth.
- Authorization.
- Data model.
- Audit/security.
- Public contracts.
- Weak proof.

Hard gates:

- Auth.
- Authorization.
- Audit/security.

## Work Phases

1. Update product/API docs and decision record.
2. Implement admin auth/role checks sufficient for this endpoint.
3. Implement suspend/reactivate service in a DB transaction.
4. Invalidate/revoke local product session or push-token records where applicable without taking ownership of Cognito refresh sessions.
5. Validate audit logs and blocked interactions.
6. Update Harness evidence.

## Stop Conditions

Pause if admin role hierarchy beyond ADMIN/SUPER_ADMIN is required, if deleted user reactivation is requested, or if new schema fields are required.
