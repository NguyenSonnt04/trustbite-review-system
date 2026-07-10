# 0021 Data Retention Thresholds As Config Constants

Date: 2026-07-10

## Status

Accepted

## Context

`Data_Retention_Policy.md` defines retention windows for several data types, but
no scheduled job enforced time-based retention (only account-deletion processing
existed). Task 6.1..6.5 requires backend retention jobs. The retention windows
are policy-owned numbers that Ops/Legal may tune, and they must be explicit and
testable rather than hard-coded inline in SQL.

## Decision

Ship the retention windows as frozen constants in
`server/src/config/retentionRules.js`, exposed through `getRetentionRules()` —
the same pattern used for anti-fraud thresholds (decision 0014). Retention job
functions receive the rules object as a parameter and derive the cutoff from an
injectable `now`; they never read env or the DB for thresholds.

Initial MVP windows (days):

- `otpRetentionDays = 30` — delete OTP verification records.
- `receiptSignalRetentionDays = 90` — anonymize raw `request_ip` and GPS
  coordinates on `receipt_verifications` (upper bound of the policy's 30-90 day
  range); the derived, non-PII `gps_distance_meters` is retained for audit.
- `notificationRetentionDays = 365` — delete notifications.

Scope of the first retention slice (TB-RETENTION-001): OTP purge, receipt IP/GPS
anonymization, and notification purge. Each action runs in its own transaction.

## Alternatives Considered

1. Inline interval literals in SQL. Rejected: thresholds become non-obvious and
   untestable, and drift from the policy doc.
2. `fraud_rule_configs`-style DB-backed config now. Rejected as premature; the
   accessor indirection lets a DB loader replace the body later without touching
   call sites.

## Consequences

Positive:

- Retention windows are explicit, documented, and unit-tested.
- Deterministic (injectable `now`) so tests are repeatable.

Tradeoffs:

- Fraud-flag (2y), audit-log (3y), and receipt-image/S3 retention are not yet
  automated; they remain follow-ups.

## Follow-Up

- Extend the retention runner to fraud flags, audit logs, and S3 receipt image
  lifecycle when those retention decisions are finalized.
- Consider a DB-backed config loader if Ops needs to tune windows without deploys.
