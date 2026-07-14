# Design

## Domain Model

Notification types in this slice are `REVIEW_VERIFIED` and `BADGE_EARNED`.
Payloads contain only opaque identifiers needed for in-app navigation:
`reviewId` or `badgeCode`. Titles and bodies must not include receipt images,
OCR text, GPS, phone numbers, tokens, or provider credentials.

Verified review awards are idempotent:

- one `+50` `exp_transactions` row per verified review,
- one `user_badges` row per user and badge,
- one review notification per user/review,
- one badge notification per user/badge.

The P1 badge rules implemented from `Gamification_Design.md` are:

- `RECEIPT_MASTER`: ten most recent submitted reviews with a final outcome are
  all `VERIFIED`.
- `EXPLORER`: the user is the first verified reviewer for five distinct
  restaurants.

## Application Flow

`verifyReceipt` keeps all side effects inside its existing transaction. After a
new `VERIFIED` decision it calls the gamification awarder, recomputes rank,
awards newly satisfied badges, and inserts notifications. Reprocessing the same
receipt performs no duplicate award or notification.

The notification query service validates pagination, scopes every query by
`recipient_user_id`, and maps database snake_case columns to API camelCase.
Mark-read updates with `read_at = COALESCE(read_at, NOW())`.

## Interface Contract

`GET /api/v1/notifications?page=1&pageSize=20`

```json
{
  "items": [
    {
      "id": "uuid",
      "type": "REVIEW_VERIFIED",
      "title": "Review của bạn đã được xác minh",
      "body": "Review đã vượt qua kiểm tra độ tin cậy.",
      "payload": { "reviewId": "uuid" },
      "readAt": null,
      "createdAt": "2026-07-14T12:30:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1,
  "unreadCount": 1
}
```

`PATCH /api/v1/notifications/{id}/read` returns the updated notification. An
unknown id or a notification owned by another user returns `404 NOT_FOUND`.
Invalid UUID or pagination input returns `422 VALIDATION_ERROR`.

`GET /api/v1/notifications/summary` returns `{ "unreadCount": 1 }` without
loading list rows and is used by the home header.

## Data Model

Existing tables remain the source of truth. A migration seeds the two badge
definitions and adds partial unique expression indexes for review and badge
notification idempotency. No new columns are added.

## UI / Platform Impact

Flutter replaces mock rows with a typed notification service. The screen
announces loading and errors, provides explicit empty and retry states, supports
pull-to-refresh, marks an unread row on activation, and exposes text labels in
addition to color/icon state. OS push permission is deferred with FCM/APNs.

## Observability

The existing receipt decision audit remains canonical. Notification payloads
and sensitive receipt data are not logged.

## Alternatives Considered

1. Database triggers were rejected because notification and badge product rules
   belong in the service transaction and require explicit tests.
2. FCM/APNs was deferred by the accepted scope in favor of the in-app contract.
