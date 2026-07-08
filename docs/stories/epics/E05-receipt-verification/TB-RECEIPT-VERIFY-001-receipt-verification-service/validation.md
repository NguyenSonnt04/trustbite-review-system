# Validation

## Strategy

TDD. Pure functions and the orchestrator are unit-tested with a mocked `pool`
(matching `reviewService.test.js`). Each Status_Mapping §3 P0 row and each §4.1
scoring row/boundary has an explicit assertion. Negative/abuse cases are
required (duplicate hash, unreadable OCR, GPS spoof via stale capturedAt,
transaction rollback on write failure).

## Unit — pure scoring (`receiptVerificationScoring.test.js`)

- `haversineMeters`: 0 for identical points; ~known distance for a fixed pair;
  symmetric.
- `normalizeMerchantName`: strips Vietnamese diacritics, lowercases, removes
  `Co., Ltd` / `CN` / `chi nhánh`, collapses whitespace, drops punctuation.
- `levenshteinSimilarity`: identical→100; both empty→100; one empty→0;
  known partial in 60–79 and <60 ranges.
- `computeTransactionHash`: deterministic; differs when any field differs;
  stable across name casing/spacing via normalization.
- `scoreReceipt`: one assertion per §4.1 row — GPS ≤200m (+0), >200m near (+40),
  >200m late (+10), absent (+30), accuracy>100 (+15); merchant 80–100 (+0),
  60–79 (+25), <60 (+60), unreadable (+50); receipt ≤48h (+0), 49–168h (+40),
  >168h (+70), unreadable (+30); dup file hash (+100); dup transaction hash
  (+100); edited metadata (+50); new account (+15); ≥3 rejected (+40);
  multi-account (+50). Plus an additive-stack case.
- `decideFromScore`: boundaries 0,30,31,60,61,99,100,150 → correct bucket and
  full status set.

## Unit — orchestrator (`receiptVerificationService.test.js`)

Mocked `pool`/client. Assert the SQL/params written per Status_Mapping §3 row:

- risk 0–30 → VERIFIED row set (review VERIFIED/VERIFIED/VERIFIED/PUBLIC/HIGH,
  receipt VERIFIED, decision VERIFIED).
- risk 31–60 → PENDING_ADMIN_REVIEW set, receipt.decision NULL.
- risk 61–99 → REFERENCE_ONLY set.
- risk ≥100 → REJECTED/PRIVATE/NONE set + fraud flag created.
- duplicate transaction hash vs prior VERIFIED → REJECTED + DUPLICATE_REJECTED +
  `DUPLICATE_TRANSACTION_HASH` fraud flag + entities (no scoring needed).
- unreadable OCR merchant + unreadable time → score lands in expected bucket.
- GPS spoof: `capturedAt` 30 min stale while distance >200m → scored as
  late/untrustworthy (+10), not allowed to dodge the +40 near penalty by
  back-dating; absent GPS → +30.
- audit_logs insert asserted for each decision.
- `BEGIN`/`COMMIT` on success; `ROLLBACK` when a write throws (no residue).
- NotFoundError when receipt id missing.
- fraud_risk_score persisted as min(raw,100) while decision uses raw.

## Commands

- `npm run test:unit` — must pass (vitest).
- `npm run server:build` — syntax check.

## DB Proof

The orchestrator is unit-proven against a mocked pool. Live insert/update +
rollback proof was also run against local PostgreSQL (`postgis/postgis:15`,
container `trustbite-postgres`) via a throwaway script (`npm run db:migrate`
applied; no new migration in this story). The script seeded a user, restaurant,
review, and OCR'd receipt, ran `verifyReceipt`, then asserted and cleaned up.

Result (2026-06-12), all PASS:

- clean receipt → VERIFIED, score 0
- `receipt_verifications.status` persisted VERIFIED; `gps_distance_meters` = 0.00
- `reviews` synced to VERIFIED / VERIFIED / VERIFIED / PUBLIC / HIGH
- one `audit_logs` row (`RECEIPT_VERIFICATION_DECISION`) written
- missing receipt id → `NotFoundError`, transaction rolled back
- audit_logs count unchanged across the failed run (1 → 1): no residue
- explicit cleanup left zero receipt rows

The proof script was removed after running (not committed).

## PR #36 venue-binding follow-up

PASS (2026-07-08).

- Added unit regression coverage for a receipt whose `branch_id` points to a
  branch owned by another restaurant.
- `verifyReceipt` now requires `restaurant_branches.parent_restaurant_id` to
  match the receipt's `restaurant_id`; otherwise scoring falls back to the
  receipt restaurant instead of using the wrong branch venue.
- `npm run test --prefix server -- tests/unit/receipt/receiptVerificationService.test.js`
  passed: 15 tests.

## Result

PASS. `npm run test:unit` 73/73 green (60 receipt-specific). `npm run build`
syntax check passed for 83 files. Live PostgreSQL transaction + rollback proof
passed with no residue.
