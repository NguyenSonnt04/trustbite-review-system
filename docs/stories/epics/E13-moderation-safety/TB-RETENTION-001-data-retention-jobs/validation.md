# Validation

## Proof Strategy

Data retention is high-risk (destructive, privacy). Proof shows each action
removes/anonymizes only rows past its window and leaves recent rows untouched,
with deterministic cutoffs (injectable `now`) and guarded rollback. No schema
change is introduced.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit (`dataRetentionService.test.js`) | OTP purge uses 30-day cutoff + commits; receipt anonymize uses 90-day cutoff, nulls IP/GPS but not `gps_distance_meters`; notification purge uses 365-day cutoff; `runDataRetention` aggregates counts (`errors: null`); continue-on-error: an earlier action failing still runs later actions and reports the error; rollback + rethrow on failure; ROLLBACK failure does not mask the original error |
| Integration | OTP: stale row deleted, fresh kept; notifications: stale deleted, fresh kept; receipts: stale IP/GPS nulled while `gps_distance_meters` retained, fresh receipt untouched |
| E2E | N/A (no UI) |
| Platform | Runner entrypoint `retention:process` executes and prints a JSON summary |
| Logs/Audit | JSON affected-row summary printed by the runner; no audit_logs product records |

## Fixtures

- `otp_purposes` code `LOGIN` seeded idempotently in `beforeAll`.
- `createUser`, `createRestaurant`, `createReview`, `createReceiptVerification`
  factories; rows aged via `created_at = now() - N days` inline.
- Real thresholds from `getRetentionRules()`.

## Commands

```bash
npm run server:test:unit
npm run server:test:integration -- tests/integration/dataRetention.integration.test.js
npm run retention:process --prefix server
npm run server:build
```

## Acceptance Evidence

- `npm run server:test:unit` — 328 passed (33 files); includes
  `tests/unit/privacy/dataRetentionService.test.js` (7 cases, incl. continue-on-error).
- `npx vitest run tests/integration/dataRetention.integration.test.js` — 3/3
  passed against live PostgreSQL (2026-07-10). Stale rows purged/anonymized,
  recent rows and derived `gps_distance_meters` retained; each case cleans up in
  `afterEach`.
- `npm run retention:process --prefix server` — ran end-to-end, printed
  `{"otpDeleted":0,"receiptSignalsAnonymized":0,"notificationsDeleted":0,"errors":null}`
  on a clean DB and closed the pool.
- Full integration suite — 127 passed, LocalStack-dependent suites skipped.
- `npm run server:build` — syntax check passed for 120 files.

## Notes

- No migration: all columns exist (`request_ip` from 007; GPS + `created_at`
  from `001`).
- Fraud-flag / audit-log / S3 receipt-image retention deferred (decision 0021).
