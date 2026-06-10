# Design

## Domain Model

- Account deletion request: a privacy workflow stored in `account_deletion_requests`.
- Request states: `REQUESTED`, `PROCESSING`, `COMPLETED`, `CANCELLED` as defined by the product state mapping.
- User deletion markers: `users.deletion_requested_at` and `users.deleted_at`.
- Session revocation: active `user_sessions` and push/session tokens are revoked when a deletion request is accepted for processing.
- Account deletion is distinct from account suspension (`users.status = SUSPENDED`) and user block/unblock (`user_blocks`).

## Application Flow

In-app request:

1. Authenticate current user.
2. Validate explicit confirmation text and optional reason.
3. Reject duplicate open requests with `DELETION_REQUEST_ALREADY_EXISTS`.
4. Create `account_deletion_requests` row and set `users.deletion_requested_at`.
5. Revoke active sessions according to the selected session strategy.
6. Return `202 Accepted` with request id, status, and scheduled deletion timestamp.

Status/cancel flow:

1. `GET /users/me/deletion-request` returns the open request or `DELETION_REQUEST_NOT_FOUND`.
2. `POST /users/me/deletion-request/cancel` cancels only if the request is still cancellable under the grace-period rule.

Processing job:

1. Select due deletion requests.
2. Revoke remaining sessions/push tokens.
3. Delete or anonymize PII according to `Data_Retention_Policy.md`.
4. Mark request `COMPLETED`, set `users.status = DELETED`, and set `users.deleted_at`. Setting `users.status = DELETED` is required so that auth middleware and session service reject new token issuance for deleted accounts (ref: `BR-AUTH-004`, decision 0007).
5. Preserve audit/fraud/legal-minimum records only where policy allows.

Web deletion path:

1. Public web form verifies identity using the approved support/privacy flow.
2. Valid requests create the same `account_deletion_requests` workflow.
3. Invalid or unverifiable requests do not mutate account data and receive a support/privacy response path.

## Interface Contract

- `POST /api/v1/users/me/deletion-request`
- `GET /api/v1/users/me/deletion-request`
- `POST /api/v1/users/me/deletion-request/cancel`
- Public web deletion form/API to be defined before store submission.

Expected errors include `VALIDATION_ERROR`, `UNAUTHORIZED`, `DELETION_REQUEST_ALREADY_EXISTS`, `DELETION_REQUEST_NOT_FOUND`, and state-conflict errors for non-cancellable requests.

## Data Model

Uses existing planned schema:

- `account_deletion_requests`
- `users.deletion_requested_at`
- `users.deleted_at`
- `user_sessions.revoked_at`
- audit metadata where required by the retention policy

Schema-changing work is high-risk and must include migration/rollback proof before implementation is marked complete.

## UI / Platform Impact

- Mobile account settings must expose Delete Account and show consequences before submit.
- Store listing must include a web deletion link/form that works outside the app.
- Copy must explain logout/session revocation, PII deletion/anonymization, retained legal/fraud/audit records, and cancellation rules if a grace period exists.

## Observability

- Audit/privacy records must show request creation, cancellation, processing, and completion without storing excessive PII.
- Operational logs must not include raw tokens, full phone numbers, or sensitive deletion reasons beyond approved audit fields.
- Deletion job should emit counts and failures for ops monitoring.

## Alternatives Considered

1. Use admin suspension as deletion: rejected because suspension is reversible account access control, not data deletion.
2. Hard-delete the user immediately from the request endpoint: rejected because session revocation, grace period, fraud/audit retention, and asynchronous cleanup need controlled processing.
3. App-only deletion path: rejected because store policies require a reachable account/data deletion path, including users who cannot access the app.
