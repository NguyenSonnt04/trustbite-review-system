# Exec Plan

## Goal

Implement the authenticated account deletion request lifecycle while keeping account suspension, user block/unblock, deletion/anonymization processing, and store-compliant web/mobile entrypoints as separate product concepts.

## Scope

In scope:

- `POST /api/v1/users/me/deletion-request`.
- `GET /api/v1/users/me/deletion-request`.
- `POST /api/v1/users/me/deletion-request/cancel` if the selected grace-period rule allows cancellation.
- `account_deletion_requests` persistence and state transitions.
- Session/push-token revocation when a deletion request is accepted.
- Current profile mutation guard while an active deletion request exists.
- Audit/privacy evidence for request lifecycle events.

Out of scope:

- Admin account suspension/reactivation.
- User-to-user block/unblock.
- General moderation/reporting.
- Public web deletion link/form implementation or identity verification.
- Mobile account-settings Delete Account UI.
- Deletion/anonymization processor, provider cleanup, object storage cleanup, trust-score recomputation, or review-summary invalidation.
- Legal finalization of public Privacy Policy or Terms copy.

## Risk Classification

Risk flags:

- Auth.
- Data model.
- Audit/security.
- Public contracts.
- Existing behavior.
- Weak proof.

Hard gates:

- Auth.
- Data loss/deletion.
- Open deletion request mutation guard ownership: this story owns the current profile mutation guard for `PATCH /users/me`; broader protected-route and fail-closed processor behavior remains owned by `TB-PRIVACY-RETENTION-JOB-001` and auth boundary work.
- Audit/security.
- Public API shape.

## Work Phases

1. Done: Confirm data retention policy and grace-period/cancellation rules.
2. Done: Confirm OpenAPI/API spec for in-app deletion request, status, and cancellation.
3. Done: Use existing schema for deletion request workflow; no migration was needed for this slice.
4. Done: Implement authenticated deletion request endpoints and duplicate-request guards.
5. Done: Implement request-time session/push-token revocation, lifecycle audit records, and the `PATCH /users/me` active-request guard.
6. Split: Public web deletion form/API identity verification remains planned under `TB-PRIVACY-WEB-DELETION-001`.
7. Split: Mobile account-settings Delete Account entrypoint remains planned under `TB-MOBILE-ACCOUNT-DELETION-001`.
8. Done: Backend unit, focused route-level integration, syntax, migration, and diff-check proof recorded.
9. Done: Update Harness matrix/story evidence for the backend request slice.

## Stop Conditions

Pause for human confirmation if:

- The grace period or cancellation rule is ambiguous.
- Product asks to hard-delete immediately without retention/audit review.
- Legal/privacy retention requirements conflict with product expectations.
- Validation requirements for request lifecycle, audit, mutation guard, or session revocation need to be weakened.
