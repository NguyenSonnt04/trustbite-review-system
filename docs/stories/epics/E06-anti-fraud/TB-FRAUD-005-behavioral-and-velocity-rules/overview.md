# TB-FRAUD-005 Behavioral and Velocity Anti-Fraud Rules

## Current Behavior

The receipt verification scoring engine already defines behavioral anti-fraud signal points for new accounts, repeated rejected receipts, and multi-account same-device/IP patterns. The receipt verification orchestrator does not yet derive those signals from persisted data and currently passes them as `false`.

Duplicate receipt protections exist for image SHA-256 and composite transaction hash, but duplicate image-hash denials need explicit audit evidence. Review creation and receipt upload daily velocity limits are documented in business rules but are not enforced in the backend service layer.

## Target Behavior

- Duplicate receipt denials remain hard anti-fraud rules and produce fraud flags plus audit evidence.
- Review creation is blocked when an authenticated user reaches the MVP daily limit of 10 reviews.
- Receipt upload is blocked when an authenticated user reaches the MVP daily limit of 20 receipts, or the lower limit of 5 receipts when the user has an open fraud flag.
- Receipt verification derives and scores behavioral signals from persisted data:
  - account created less than 24 hours ago and first review,
  - three or more rejected receipts in the last 7 days,
  - another account using the same IP for the same restaurant within 24 hours.
- The implementation uses basic IP/User-Agent request-signal tracking for MVP. Full client-side device fingerprinting remains out of scope until legal basis, explicit consent, and retention rules are approved.

## Affected Users

- Reviewers creating reviews and uploading receipts.
- Admins reviewing fraud flags and audit records.
- Support/security operators investigating duplicate or velocity-based abuse.

## Affected Product Docs

- `docs/product/verification.md`
- `docs/product/reviews.md`
- `trustbite-docs/05_Security_Algorithms/Anti_Fraud_Specification.md`
- `trustbite-docs/02_Business_Analysis/Business_Rules.md`

## Non-Goals

- Full browser/mobile device fingerprint SDK or persisted fingerprint table.
- Redis-backed rate limiting for review/receipt daily limits.
- EXIF/AI edited-metadata detection.
- Admin moderation UI changes.
- New public API endpoints.

## Status

in-progress

Delivered in this slice (proven by unit tests, see `validation.md`):

- Orchestrator now derives and scores the three behavioral signals from
  persisted data: new-account + first-review (`+15`), `>=3` rejected receipts in
  7 days (`+40`), and multi-account same-IP within 24h (`+50`).
- `request_ip` capture at receipt upload + migration `007` + supporting index.
- Behavioral thresholds added to `fraudRules.js`.

Deferred (follow-up, not in this slice):

- Daily hard rate limits at review creation (10/day) and receipt upload (20/day,
  5/day with open fraud flag) — BR-RATE-003/004. Wiring count guards into the
  `reviewService`/`receiptService` positional-mock test chains is a separable
  slice; the velocity *signal* is already delivered here.
- Live DB apply/rollback proof for migration `007` (local Docker/PostgreSQL was
  unavailable; documented blocker in `validation.md`).
