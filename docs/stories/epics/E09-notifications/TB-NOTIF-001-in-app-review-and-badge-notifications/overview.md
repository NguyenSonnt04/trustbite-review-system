# TB-NOTIF-001 In-App Review And Badge Notifications

## Current Behavior

The Flutter notifications page renders three local mock rows and a fixed badge.
The backend schema already contains `notifications`, but no authenticated API
creates, lists, or marks notifications as read. Receipt verification updates a
review, while gamification remains read-only and does not award EXP or badges.

## Target Behavior

- A successful automated `VERIFIED` review decision atomically awards the
  documented EXP, evaluates the P1 verified-review badges, and creates in-app
  notifications for the review verification and each newly earned badge.
- `GET /api/v1/notifications` returns only the authenticated recipient's
  notifications, newest first, with pagination and unread count.
- `PATCH /api/v1/notifications/{id}/read` idempotently marks only the
  authenticated recipient's notification as read.
- The Flutter notification screen uses the API and provides loading, empty,
  error, retry, refresh, read, and accessible semantic states.

## Affected Users

- Authenticated reviewers receiving verification and badge outcomes.

## Affected Product Docs

- `docs/product/notifications.md`
- `docs/product/gamification.md`
- `docs/product/verification.md`
- `trustbite-docs/04_Software_Engineering/API_Specification.md`
- `trustbite-docs/05_Security_Algorithms/Gamification_Design.md`

## Non-Goals

- FCM/APNs delivery, token registration, or operating-system notification
  permission prompts.
- Helpful-vote EXP, moderation revocation, or future Night Owl badge rules.
- Completing admin/manual verification flows.
