# Validation

## Proof Strategy

TDD with a mocked `pool` (matching `receiptVerificationService.test.js`). Each
behavioral signal has a positive and a negative assertion. The scoring-table
point values themselves are already covered in
`receiptVerificationScoring.test.js` (`new account +15`, `>=3 rejected +40`,
`multi-account +50`); this story proves the orchestrator now *derives* those
signals from persisted data.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | New account (<24h) + first review → +15 → VERIFIED; account age anchored on review submission time (not async decision time); new account with an earlier review → no penalty; established account (>24h) → no penalty; `>=3` rejected receipts in 7d → +40 → PENDING; `<3` rejected → no penalty; same IP + another account + same restaurant within 24h → +50 → PENDING (params exclude current user, scope to restaurant); same IP with no other account → no penalty; no request IP → same-IP lookup skipped; stacked signals (15+40+50=105) → REJECTED + fraud flag + score capped at 100. Existing orchestrator/scoring suites remain green. `receiptService` INSERT now includes `request_ip`. |
| Integration | Deferred: requires live PostgreSQL (see DB Proof). |
| E2E | Not applicable — no UI in scope. |
| Platform | Not applicable — no provider/container behavior changed. |
| Performance | Not applicable. |
| Logs/Audit | Signal codes surface in the decision `audit_logs` reason; `>=100` creates a `fraud_flags` row on the dominant signal (existing behavior, re-verified). |

## Fixtures

Deterministic IDs and a fixed `now` (`2026-06-12T10:00:00Z`) from the existing
orchestrator test. `setupScenario` was extended with `user`, `earlierReviewRows`,
`rejectedCount`, and `sameIpRows` so each signal can be isolated.

## Commands

```text
npx vitest run tests/unit/receipt/receiptVerificationService.test.js tests/unit/receiptService.test.js
npm run test:unit --prefix server
npm run server:build
```

## Acceptance Evidence

Validated 2026-07-10:

- `npm run test:unit` — 21 files / 232 tests passed (was 222; +10 behavioral cases,
  including a regression that pins account-age to review submission time rather
  than the async decision time).
- `npm run server:build` — syntax check passed for 104 files.

## DB Proof

PASS (2026-07-10) against local PostgreSQL (`trustbite-postgres`).

- `npm run db:migrate` applied `007_add_receipt_request_ip.sql` (5 migrations
  applied). Verified `receipt_verifications.request_ip` is `inet` and index
  `idx_receipts_request_ip_restaurant` exists.
- A throwaway proof script (seed inside one transaction, then ROLLBACK) proved:
  same-IP multi-account lookup finds another account's receipt for the same
  restaurant within 24h; a different IP finds no match; the rejected-receipt
  velocity count query runs. Residue check after rollback: 0 rows left.
- The script was removed after running (not committed).

Remaining (not a migration blocker): the daily hard rate limits (BR-RATE-003/004)
are still deferred to a separate slice, and a committed integration test through
the HTTP boundary is deferred (behavioral derivation is unit-proven with mocks
plus this live DB proof).
