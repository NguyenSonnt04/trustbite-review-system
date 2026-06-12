# Exec Plan

## Goal

Implement account deletion request handling and store-compliant deletion access while keeping account suspension, user block/unblock, and privacy deletion as separate product concepts.

## Scope

In scope:

- `POST /api/v1/users/me/deletion-request`.
- `GET /api/v1/users/me/deletion-request`.
- `POST /api/v1/users/me/deletion-request/cancel` if the selected grace-period rule allows cancellation.
- Public web deletion link/form contract before store submission.
- `account_deletion_requests` persistence and state transitions.
- Session/push-token revocation when a deletion request is accepted/processed.
- Deletion/anonymization processing according to `Data_Retention_Policy.md`.
- Audit/privacy evidence for request lifecycle events.

Out of scope:

- Admin account suspension/reactivation.
- User-to-user block/unblock.
- General moderation/reporting.
- Legal finalization of public Privacy Policy or Terms copy.

## Risk Classification

Risk flags:

- Auth.
- Data model.
- Audit/security.
- Public contracts.
- Existing behavior.
- Weak proof.
- Cross-platform/store compliance.

Hard gates:

- Auth.
- Data loss/deletion.
- Open deletion request mutation guard ownership: `TB-PRIVACY-RETENTION-JOB-001` owns the hard gate for blocking protected mutations during open `REQUESTED`/`PROCESSING` deletion requests unless this story is explicitly re-scoped to implement and prove that guard.
- Audit/security.
- Public API shape.

## Work Phases

1. Confirm data retention policy and grace-period/cancellation rules.
2. Confirm OpenAPI/API spec for in-app deletion request, status, cancellation, and web deletion path.
3. Implement DB migration and rollback for deletion request workflow if not already present.
4. Implement authenticated deletion request endpoints and duplicate-request guards.
5. Implement session/push-token revocation and deletion/anonymization worker/job. The dedicated job slice is tracked in `docs/stories/epics/E04-auth-identity/TB-PRIVACY-RETENTION-JOB-001-deletion-anonymization-processing/` and owns the open-deletion mutation guard hard gate unless this story is explicitly re-scoped to implement and prove it.
6. Implement or document web deletion form/API identity verification path.
7. Validate privacy, audit, session revocation, and store-readiness scenarios.
8. Update Harness matrix/story evidence and release checklist.

## Stop Conditions

Pause for human confirmation if:

- The grace period or cancellation rule is ambiguous.
- Product asks to hard-delete immediately without retention/audit review.
- Legal/privacy retention requirements conflict with product expectations.
- Web deletion identity verification cannot be defined safely.
- Validation requirements for deletion/anonymization or session revocation need to be weakened.
