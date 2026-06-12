# Design

## Domain Model

- Account deletion request: a privacy workflow stored in `account_deletion_requests`.
- Request states: `REQUESTED`, `PROCESSING`, `COMPLETED`, `CANCELLED` as defined by the product state mapping.
- User deletion marker owned by this slice: `users.deletion_requested_at`. `users.deleted_at` is owned by the processing story.
- Session revocation: active `user_sessions` and push tokens are revoked when a deletion request is accepted.
- Account deletion is distinct from account suspension (`users.status = SUSPENDED`) and user block/unblock (`user_blocks`).

## Application Flow

In-app request:

1. Authenticate current user.
2. Validate explicit confirmation text and optional reason.
3. Reject duplicate open requests with `DELETION_REQUEST_ALREADY_EXISTS`.
4. Create `account_deletion_requests` row and set `users.deletion_requested_at`.
5. Revoke active sessions according to the selected session strategy.
6. Write a lifecycle audit record without copying user-provided deletion reason into `audit_logs.reason`.
7. Return `202 Accepted` with request id, status, and scheduled deletion timestamp.

Status/cancel flow:

1. `GET /users/me/deletion-request` returns the open request or `DELETION_REQUEST_NOT_FOUND`.
2. `POST /users/me/deletion-request/cancel` cancels only if the request is still cancellable under the grace-period rule.
3. Cancellation clears `users.deletion_requested_at` and writes a lifecycle audit record.

Active-request guard:

1. `PATCH /users/me` rejects profile mutations while the current user has an active `REQUESTED` or `PROCESSING` deletion request.
2. Deletion status/cancel operations remain allowed through their dedicated service paths.

Processing job:

The dedicated processing slice is tracked in `docs/stories/epics/E04-auth-identity/TB-PRIVACY-RETENTION-JOB-001-deletion-anonymization-processing/`. This story does not implement processor selection, anonymization, provider cleanup, storage cleanup, trust-score recomputation, or review-summary invalidation.

Web deletion path:

The public web deletion link/form remains required before store submission, but implementation is tracked separately by `TB-PRIVACY-WEB-DELETION-001` because safe identity verification and support/privacy routing are not yet defined in this story.

## Interface Contract

- `POST /api/v1/users/me/deletion-request`
- `GET /api/v1/users/me/deletion-request`
- `POST /api/v1/users/me/deletion-request/cancel`
- `PATCH /api/v1/users/me` returns `DELETION_REQUEST_ACTIVE` while an open deletion request exists.
- Public web deletion form/API is tracked by `TB-PRIVACY-WEB-DELETION-001`.

Expected errors include `VALIDATION_ERROR`, `UNAUTHORIZED`, `DELETION_REQUEST_ALREADY_EXISTS`, `DELETION_REQUEST_NOT_FOUND`, and state-conflict errors for non-cancellable requests.

## Data Model

Uses existing planned schema:

- `account_deletion_requests`
- `users.deletion_requested_at`
- `user_sessions.revoked_at`
- `push_tokens.status`
- audit metadata where required by the retention policy

The deletion/anonymization worker details live in `TB-PRIVACY-RETENTION-JOB-001-deletion-anonymization-processing`.

Schema-changing work is high-risk and must include migration/rollback proof before implementation is marked complete.

## UI / Platform Impact

- Mobile account settings must expose Delete Account and show consequences before submit; this remains tracked by `TB-MOBILE-ACCOUNT-DELETION-001`.
- Store listing must include a web deletion link/form that works outside the app; this remains tracked by `TB-PRIVACY-WEB-DELETION-001`.
- Copy must explain logout/session revocation, PII deletion/anonymization, retained legal/fraud/audit records, and cancellation rules if a grace period exists.

## Observability

- Audit/privacy records must show request creation and cancellation without storing excessive PII.
- Operational logs must not include raw tokens, full phone numbers, or sensitive deletion reasons beyond approved audit fields.
- Processor completion, provider cleanup, storage cleanup, and job monitoring belong to `TB-PRIVACY-RETENTION-JOB-001`.

## Alternatives Considered

1. Use admin suspension as deletion: rejected because suspension is reversible account access control, not data deletion.
2. Hard-delete the user immediately from the request endpoint: rejected because session revocation, grace period, fraud/audit retention, and asynchronous cleanup need controlled processing.
3. App-only deletion path: rejected because store policies require a reachable account/data deletion path, including users who cannot access the app.
