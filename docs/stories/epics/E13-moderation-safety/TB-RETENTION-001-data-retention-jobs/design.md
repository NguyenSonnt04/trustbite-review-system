# Design

## Domain Model

No schema change. The jobs operate on existing tables and columns:

| Table | Columns used | Action |
| --- | --- | --- |
| `otp_verifications` | `created_at` | delete rows older than window |
| `receipt_verifications` | `created_at`, `request_ip`, `gps_latitude`, `gps_longitude`, `gps_accuracy_meters` | null the raw signal columns |
| `notifications` | `created_at` | delete rows older than window |

Thresholds live in `config/retentionRules.js` (decision 0021), in days:
`otpRetentionDays=30`, `receiptSignalRetentionDays=90`,
`notificationRetentionDays=365`.

## Application Flow

`dataRetentionService.js`:

- `cutoffDate(now, days)` derives the cutoff from an injectable `now`.
- Each action runs inside `runInTransaction` (BEGIN → work → COMMIT, guarded
  ROLLBACK on error that never masks the original error) and returns its
  affected-row count.
- `runDataRetention({ now, rules })` runs the three actions sequentially and
  returns `{ otpDeleted, receiptSignalsAnonymized, notificationsDeleted }`.

Actions are independent: each commits on its own, so one failure does not roll
back rows already retained by an earlier action.

## Interface Contract

Not an HTTP endpoint. Entry point is the CLI runner
`server/scripts/process-retention.mjs` (`npm run retention:process --prefix
server`), which prints the JSON summary for log ingestion and is intended to be
invoked by a scheduler (cron / ECS scheduled task).

The `anonymizeStaleReceiptSignals` UPDATE nulls only the raw signal columns and
intentionally does not touch `gps_distance_meters` (derived, non-PII, retained
for audit).

## Data Model

No migration. All columns exist (`request_ip` from migration 007; GPS columns and
`created_at` from `001_init_schema.sql`). The jobs are destructive by design
(retention), bounded by explicit config thresholds and proven with live-DB tests.

## UI / Platform Impact

None. Scheduler wiring (cron/ECS scheduled task) is an infra concern, out of
scope for this backend slice.

## Observability

The runner prints a JSON summary of affected-row counts per action. Retention is
an operational activity; no `audit_logs` product records are written.

## Alternatives Considered

1. One big transaction for all actions. Rejected: independent retention concerns
   should not roll back each other; per-action transactions are more resilient.
2. Inline SQL interval literals. Rejected: thresholds must be explicit,
   testable config (decision 0021).
3. Deleting instead of anonymizing receipt rows past the IP/GPS window.
   Rejected: the receipt/verification record itself has its own longer retention;
   only the raw IP/GPS signals are anonymized.
