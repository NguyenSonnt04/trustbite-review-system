# Design

## Domain Model

The pure scoring engine (`receiptVerificationScoring.js`) already defines the
signal point values (Anti-Fraud §4.1):

- `newAccount` → `+15`
- `manyRejectedReceipts` → `+40`
- `multiAccountSameDevice` → `+50`

This story adds the derivation of those boolean signals from persisted data. The
scoring, bucketing (§4.2), and status synchronization are unchanged.

## Application Flow

`verifyReceipt(receiptVerificationId)` runs inside one transaction. After the
hard duplicate-transaction-hash rule and the GPS/merchant/age signals, it now
calls `deriveBehavioralSignals(client, { review, receipt, now, rules })`:

- New account + first review:
  1. `SELECT created_at FROM users WHERE id = review.user_id`.
  2. If `review.created_at - user.created_at < newAccountWindowMs` (24h) — account
     age measured at review submission time, not decision time, so async OCR
     latency cannot drop the signal — check for any earlier review:
     `SELECT 1 FROM reviews WHERE user_id = $1 AND id <> $2 AND created_at < $3 LIMIT 1`.
  3. Signal is true only when the account is new AND no earlier review exists.
- Many rejected receipts:
  - `SELECT COUNT(*) FROM receipt_verifications WHERE user_id = $1 AND id <> $2
    AND status = 'REJECTED' AND created_at >= now - rejectedReceiptWindowMs`.
  - True when count `>= rejectedReceiptThreshold` (3 in 7 days). The receipt
    under decision is excluded.
- Multi-account same IP (MVP device signal):
  - Only runs when `receipt.request_ip` is present.
  - `SELECT 1 FROM receipt_verifications WHERE request_ip = $1 AND restaurant_id = $2
    AND user_id <> $3 AND created_at >= now - sameIpWindowMs LIMIT 1`.
  - True when another account uploaded from the same IP for the same restaurant
    within 24h.

The three booleans feed `scoreReceipt(signals, rules)` alongside the existing
GPS/merchant/age signals; `decideFromScore` maps the total to the bucket.

## Interface Contract

No new or changed public routes. `POST /api/v1/receipts` now records the caller
IP (`req.ip`) into `receipt_verifications.request_ip`. Request/response bodies
are unchanged; IP is server-derived and never client-supplied.

## Data Model

Migration `007_add_receipt_request_ip.sql`:

- `ALTER TABLE receipt_verifications ADD COLUMN IF NOT EXISTS request_ip INET;`
  (nullable — GPS/IP are optional signals).
- `CREATE INDEX idx_receipts_request_ip_restaurant ON receipt_verifications
  (request_ip, restaurant_id, created_at) WHERE request_ip IS NOT NULL;`
- Rollback documented inline (drop index, drop column).

Thresholds in `fraudRules.js` (frozen constants, Decision 0014):
`newAccountWindowMs`, `rejectedReceiptWindowMs`, `rejectedReceiptThreshold`,
`sameIpWindowMs`.

Retention/privacy: `request_ip` is PII and is excluded from
`ReceiptVerificationModel.toJSON()` (same treatment as `ocr_text`).

## UI / Platform Impact

None. Backend-only decision logic.

## Observability

Behavioral signals appear in the existing decision `audit_logs` row via the
`decision_reason` breakdown (e.g. `NEW_ACCOUNT_FIRST_REVIEW(+15)`,
`MANY_REJECTED_RECEIPTS(+40)`, `MULTI_ACCOUNT_SAME_DEVICE(+50)`). A `>=100`
total still creates a `fraud_flags` row on the dominant signal.

## Alternatives Considered

1. Add a dedicated device-fingerprint table and client SDK now — rejected: spec
   §9 defers this to V1.1 pending legal basis/consent/retention; MVP uses a
   basic IP request-signal instead.
2. Compute "first review" via `COUNT(*) = 1` — rejected in favor of an
   earlier-review existence check keyed on `created_at`, which is correct even
   if the user created multiple reviews before uploading a receipt.
3. Store IP on `reviews` instead of `receipt_verifications` — rejected: the
   signal is about receipt uploads for a restaurant, and the receipt row already
   carries `restaurant_id` and the upload timestamp.
