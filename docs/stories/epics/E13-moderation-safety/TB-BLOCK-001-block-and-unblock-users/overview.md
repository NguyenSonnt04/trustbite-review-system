# TB-BLOCK-001 Block and Unblock Users

## Current Behavior

The `user_blocks` table and `UserBlockModel` exist in the schema
(`001_init_schema.sql`) and `server/src/models/system/userBlock.js`, but there is
no service, controller, or route. Users cannot block or unblock another user, so
the UGC-safety block requirement (SAFETY-001 / BR-SAFE-003) is unmet in the
backend.

## Target Behavior

Authenticated users can block and unblock another user within TrustBite's
community feature scope.

- `POST /api/v1/users/{userId}/block` creates (or reactivates) a block from the
  current user toward the target user and returns `{ blockedUserId, blockedAt }`.
- `DELETE /api/v1/users/{userId}/block` soft-removes the active block and returns
  `{ success: true }`.
- A block is a user-to-user relationship only. It does not suspend, delete, or
  otherwise change the target account (BR-SAFE-003, BR-ADM-006).
- Suspended or deleted actors cannot block/unblock (enforced by existing
  `authMiddleware` account-state gate).

## Affected Users

- Reviewers/community users restricting interaction from abusive users.

## Affected Product Docs

- `trustbite-docs/04_Software_Engineering/API_Specification.md` (§7 Kiểm duyệt)
- `trustbite-docs/02_Business_Analysis/Functional_Specification.md` (SAFETY-001)
- `trustbite-docs/02_Business_Analysis/Business_Rules.md` (BR-SAFE-003)
- `trustbite-docs/06_Database_Design/Data_Dictionary.md` (`user_blocks`)

## Non-Goals

- Report/moderation-queue endpoint (task 6.1, separate story).
- Admin suspend/reactivate (already delivered, TB-ADMIN-USER-MANAGEMENT-001).
- Feed/review-list filtering that hides a blocked user's content (client/read-path
  concern, separate slice).
- Blocking restaurants or reviews (only `entity_type = USER` block is in scope).

## Status

in-progress
