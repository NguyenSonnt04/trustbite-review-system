# Design

## Domain Model

`user_blocks` (existing schema, source of truth — not modified):

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID PK | `gen_random_uuid()` default |
| `blocker_user_id` | UUID NOT NULL | FK `users(id)` ON DELETE CASCADE |
| `blocked_user_id` | UUID NOT NULL | FK `users(id)` ON DELETE CASCADE |
| `reason_code` | VARCHAR(60) NULL | optional free reason code |
| `source_review_id` | UUID NULL | FK `reviews(id)` ON DELETE SET NULL |
| `created_at` | TIMESTAMPTZ NOT NULL | `now()` default |
| `deleted_at` | TIMESTAMPTZ NULL | soft-delete for unblock |
| | | `UNIQUE(blocker_user_id, blocked_user_id)` |
| | | `CHECK (blocker_user_id <> blocked_user_id)` |

Key consequence: the uniqueness is on the pair regardless of `deleted_at`.
A re-block after an unblock must **reactivate** the existing row
(`deleted_at = NULL`, refresh `reason_code`/`source_review_id`/`created_at`),
never insert a second row.

## Application Flow

Block command (`blockUser(blockerUserId, targetUserId, { reasonCode, sourceReviewId })`):

1. Validate `targetUserId` is a UUID (422 otherwise, avoids `22P02`).
2. Reject self-block: `blockerUserId === targetUserId` → `400 CANNOT_BLOCK_SELF`.
3. Normalize `reasonCode` (≤ 60 chars, empty → null) and `sourceReviewId`
   (UUID or null).
4. In a transaction:
   - `404 NOT_FOUND` if target user row is absent.
   - `SELECT ... FOR UPDATE` the pair row:
     - exists and active (`deleted_at IS NULL`) → `409 USER_ALREADY_BLOCKED`;
     - exists and soft-deleted → reactivate;
     - absent → insert.
   - COMMIT and return `{ blockedUserId, blockedAt }`.

Unblock command (`unblockUser(blockerUserId, targetUserId)`):

1. Validate `targetUserId` is a UUID (422).
2. In a transaction: soft-delete the active row
   (`deleted_at = now()` WHERE active). `0` rows → `404 NOT_FOUND`.
3. COMMIT and return `{ success: true }`.

## Interface Contract

`POST /api/v1/users/{userId}/block` (auth required)

- Body: `{ "reasonCode"?: string, "sourceReviewId"?: uuid }`
- `201` → `{ "blockedUserId": uuid, "blockedAt": timestamptz }`
- Errors: `400 CANNOT_BLOCK_SELF`, `401 AUTH_REQUIRED`,
  `403 ACCOUNT_SUSPENDED` / `403 ACCOUNT_DELETED` (actor, via middleware),
  `404 NOT_FOUND`, `409 USER_ALREADY_BLOCKED`, `422 VALIDATION_ERROR`.

`DELETE /api/v1/users/{userId}/block` (auth required)

- `200` → `{ "success": true }`
- Errors: `401 AUTH_REQUIRED`, `403 ACCOUNT_SUSPENDED` / `403 ACCOUNT_DELETED`,
  `404 NOT_FOUND`, `422 VALIDATION_ERROR`.

Actor account-state (`SUSPENDED`/`DELETED`/active deletion request) is enforced
by the existing `authMiddleware` before the controller runs, matching the
API spec's actor `403` cases.

## Data Model

No schema change. All columns/constraints already exist in
`server/migrations/001_init_schema.sql`. Postgres error mapping guards races and
bad references: `23505` → `409`, `23514` (self-block check) → `400`,
`23503` on `source_review_id` → `422`, `23503` on `blocked_user_id` → `404`.

## UI / Platform Impact

None in this slice. Mobile block UI (task 6.3) and feed hiding are separate.

## Observability

No `audit_logs` write: user-to-user block is a community action, not an admin
moderation/restrict action. `Functional_Specification` reserves audit logging
for admin restrict/suspend and report handling. Standard request logging applies.

## Alternatives Considered

1. `INSERT ... ON CONFLICT DO UPDATE` upsert. Rejected: needs to distinguish
   active vs soft-deleted to return `409` correctly; explicit `SELECT FOR UPDATE`
   is clearer and race-safe.
2. Hard delete on unblock. Rejected: schema provides `deleted_at`; soft-delete
   preserves block history and matches the model comment.
