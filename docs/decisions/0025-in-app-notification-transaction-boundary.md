# 0025 In-App Notification Transaction Boundary

Date: 2026-07-14

## Status

Accepted

## Context

Review verification, EXP, ranks, badges, and notifications affect one user
outcome. The existing notification screen is mock-only, while the database
already has the required records. Duplicate OCR processing and worker retries
must not create repeated rewards or notifications.

## Decision

Create verified-review rewards, newly earned badges, and their in-app
notifications inside the existing receipt-verification database transaction.
Use accepted unique constraints and partial expression indexes for idempotency.
Expose notifications only through authenticated, recipient-scoped APIs.

Only opaque navigation identifiers are allowed in payloads. FCM/APNs delivery
and native permission prompts remain a separate provider boundary.

## Alternatives Considered

1. Asynchronous best-effort notification creation after commit was rejected
   because it can separate the visible notification from the persisted reward.
2. Database triggers were rejected because they hide product rules and are
   harder to validate against provider and privacy boundaries.
3. Implementing FCM/APNs immediately was rejected by the selected in-app-first
   scope and missing external provider configuration.

## Consequences

Positive:

- Worker retries are exactly-once from the user's perspective.
- Review status, EXP, badges, rank, and in-app notifications commit or roll back
  together.
- Mobile can replace mock data without requiring push credentials.

Tradeoffs:

- The receipt verification transaction performs additional indexed queries.
- Future push delivery must consume persisted notifications without duplicating
  product-event rules.

## Follow-Up

- Add a separate high-risk provider story for FCM/APNs, encrypted push-token
  registration, delivery logs, and native permission prompts.
- Add moderation-driven reward revocation when that contract is accepted.
