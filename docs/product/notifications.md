# Notification Product Contract

TrustBite notifications are authenticated, recipient-owned in-app records.
They are supplementary to direct review/receipt refetch and must never be the
only source of verification truth.

## Enabled Events

- `REVIEW_VERIFIED`: created once when a review first reaches the automated
  `VERIFIED` outcome.
- `BADGE_EARNED`: created once for each newly awarded badge.

No notification payload may contain OTP values, auth/session tokens, receipt
images, full OCR text, raw GPS, full phone numbers, provider credentials, or
other sensitive evidence. Payloads in this slice contain only `reviewId` or
`badgeCode`.

## API

- `GET /api/v1/notifications?page=1&pageSize=20`
  - authenticated,
  - newest first,
  - page starts at 1,
  - page size is 1 through 100,
  - returns `items`, `page`, `pageSize`, `total`, and `unreadCount`.
- `GET /api/v1/notifications/summary`
  - authenticated,
  - returns `{ unreadCount }` for lightweight home-badge refresh.
- `PATCH /api/v1/notifications/{id}/read`
  - authenticated,
  - recipient-owned,
  - idempotent,
  - returns the updated notification,
  - returns `404` for missing or foreign-owned ids.

## Mobile States

The Flutter screen must provide loading, empty, error with retry,
pull-to-refresh, pagination, and content states. Unread state must be
communicated by text/semantics rather than color alone. Guest users are asked to
sign in before loading notifications.

## Delivery Boundary

This contract covers in-app records only. FCM/APNs token registration, native
push delivery, and operating-system notification permission prompts require a
separate provider story. The app must not request notification permission until
push delivery exists and the user has seen a value explanation.
