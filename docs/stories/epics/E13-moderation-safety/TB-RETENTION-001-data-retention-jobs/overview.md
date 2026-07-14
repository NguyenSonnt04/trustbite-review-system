# TB-RETENTION-001 Scheduled Data Retention Jobs

## Current Behavior

Account-deletion retention is handled by `accountDeletionProcessor.js`
(`deletions:process`), but there is no time-based retention job for other data
types. OTP verifications, notifications, and raw IP/GPS signals on receipts
accumulate indefinitely, so the `Data_Retention_Policy.md` windows are not
enforced.

## Target Behavior

A scheduled data-retention runner enforces the policy windows against
PostgreSQL:

- `purgeExpiredOtpVerifications` — delete `otp_verifications` older than 30 days.
- `anonymizeStaleReceiptSignals` — null `request_ip`, `gps_latitude`,
  `gps_longitude`, `gps_accuracy_meters` on `receipt_verifications` older than
  90 days (retain derived, non-PII `gps_distance_meters` for audit).
- `purgeExpiredNotifications` — delete `notifications` older than 365 days.

`runDataRetention()` runs the actions and returns an affected-row summary;
`npm run retention:process --prefix server` is the scheduler entrypoint.
Thresholds are config constants (decision 0021).

## Affected Users

- All users, indirectly: their stale OTP/notification/IP/GPS data is purged or
  anonymized per policy.
- Ops/Security running the scheduled retention job.

## Affected Product Docs

- `trustbite-docs/08_Compliance_and_Privacy/Data_Retention_Policy.md`
- `trustbite-docs/06_Database_Design/Migration_and_Seed_Plan.md`

## Non-Goals

- Account-deletion retention (already delivered by `accountDeletionProcessor.js`).
- Fraud-flag (2y) and audit-log (3y) retention — deferred (decision 0021).
- Original receipt image / S3 object lifecycle — deferred.
- OTP stored in Redis (TTL-managed) — only the DB `otp_verifications` table is in
  scope.
- A hosted scheduler/cron resource (infra) — the runnable script is provided;
  wiring it to a scheduled task is an infra concern.

## Status

in-progress
