# Exec Plan

## Goal

Deliver backend scheduled data-retention jobs (task 6.5, PHASE 6 — Moderation &
Compliance) that enforce the `Data_Retention_Policy.md` windows for OTP records,
receipt IP/GPS signals, and notifications.

## Scope

In scope:

- `config/retentionRules.js` threshold constants (decision 0021).
- `dataRetentionService.js`: `purgeExpiredOtpVerifications`,
  `anonymizeStaleReceiptSignals`, `purgeExpiredNotifications`, `runDataRetention`.
- `scripts/process-retention.mjs` runner + `retention:process` script.
- Unit tests (mocked pool) and live-DB integration tests.

Out of scope:

- Account-deletion retention (already delivered).
- Fraud-flag / audit-log / S3 receipt-image retention (deferred, decision 0021).
- Redis OTP TTL.
- Scheduler/cron infra resource.

## Risk Classification

Risk flags:

- Data model (destructive time-based purge/anonymization of persisted data).
- Audit/security/privacy (retention enforces the privacy policy).

Hard gates:

- Data retention/deletion → high-risk.

No schema change; no new table/column/index/constraint.

## Work Phases

1. Discovery — README, intake, architecture, context rules, retention policy,
   schema, existing deletion processor/runner. (done)
2. Design — per-action transactions, config thresholds, injectable clock. (done)
3. Validation planning — unit cutoff/rollback proofs + live-DB retention proofs.
4. Implementation — config, service, runner, script.
5. Verification — `server:test:unit`, live integration, `server:build`.
6. Harness update — story record + matrix + decision 0021.

## Stop Conditions

Pause for human confirmation if:

- A retention action would delete legal/audit records (fraud flags, audit logs)
  whose retention decision is not finalized.
- Receipt image/S3 lifecycle deletion is requested (external, irreversible).
- A schema/column change is required to drive a retention window.
