# 0009 User Account Suspension Contract

Date: 2026-06-10

## Status

Accepted

## Context

TrustBite docs contain three related but distinct account-safety concepts: review restriction, account suspension, and user block/unblock. The backend Phase 2 work needs account lock behavior that prevents login and interaction without confusing it with account deletion/data deletion.

## Decision

TrustBite will keep the concepts distinct:

- Review restriction uses `users.review_restricted_until` and only prevents writing reviews for a bounded period.
- Account suspension uses `users.status = SUSPENDED` and prevents login, refresh, profile/avatar update, review, receipt upload, report/block, and other authenticated mutations.
- User block/unblock uses `user_blocks` and only controls one user's UGC interaction/filtering with another user.
- Account deletion uses `account_deletion_requests`, `users.deletion_requested_at`, and `users.deleted_at`; it is not the same as suspension.

Admin account lock/unlock API contract:

- `POST /api/v1/admin/users/{userId}/suspend`
- `POST /api/v1/admin/users/{userId}/reactivate`

Both require ADMIN or SUPER_ADMIN, reason text, and audit logs. Suspension must revoke active user sessions. Reactivation does not restore old sessions; the user must authenticate again. Deleted users cannot be reactivated by this flow.

## Alternatives Considered

1. Use account deletion request for lock: rejected because deletion is a privacy/data-retention workflow.
2. Use user block for lock: rejected because block is a user-to-user UGC relationship.
3. Use only `review_restricted_until`: rejected because it does not block login/profile/session interactions.

## Consequences

Positive:

- Auth/session middleware has a clear account-level deny state.
- Store/UGC safety concepts remain traceable and testable.
- No schema field is added outside current `users.status`, `user_sessions`, and `audit_logs` model.

Tradeoffs:

- Admin authorization and audit proof are required before implementation can be considered complete.
- Existing docs and OpenAPI must include the admin suspend/reactivate endpoints before coding.

## Follow-Up

- Add integration proof for session revocation and suspended-user rejection.
- Add admin role test fixtures before backend implementation validation.
