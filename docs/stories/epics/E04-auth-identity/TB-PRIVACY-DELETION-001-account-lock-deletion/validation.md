# Validation

## Proof Strategy

Prove account deletion request creation, duplicate prevention, status lookup, optional cancellation, session/push-token revocation, deletion/anonymization processing, audit/privacy records, and store-compliant web deletion access before marking implemented.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Confirmation text validation, open-request duplicate guard, state transition validation, cancellable/non-cancellable request logic, PII anonymization mapping. |
| Integration | Authenticated deletion request creates `account_deletion_requests`, sets `users.deletion_requested_at`, revokes sessions; duplicate request returns `DELETION_REQUEST_ALREADY_EXISTS`; status endpoint returns open request; cancellation works only during grace period; processing job sets `COMPLETED` and `users.deleted_at`. |
| E2E | Mobile/account settings deletion request flow; logged-out/web deletion request path reaches privacy/support queue or creates verified request. |
| Platform | Store checklist confirms in-app delete entry and public web deletion link/form on iOS/Android release candidates. |
| Performance | Batch deletion/anonymization job handles MVP data volume without blocking request endpoints. |
| Logs/Audit | Audit/privacy lifecycle records exist; operational logs omit raw tokens, full phone numbers, and unnecessary PII/reasons. |

## Fixtures

- Active user with active sessions and push tokens.
- User with existing open deletion request.
- Deletion request in `REQUESTED`, `PROCESSING`, `COMPLETED`, and `CANCELLED` states.
- User with reviews, receipts, audit/fraud records, and profile PII.
- Web deletion requester who cannot log in but can verify identity through the approved support/privacy flow.

## Commands

```text
npm run db:migrate
# DB insert/rollback SQL proof for account_deletion_requests, users.deletion_requested_at, users.deleted_at, and user_sessions revocation
# API smoke commands for deletion request/status/cancel to be added during implementation
# Deletion/anonymization job smoke command to be added during TB-PRIVACY-RETENTION-JOB-001 implementation
```

## Acceptance Evidence

TBD after implementation.
