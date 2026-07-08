# Design

## Domain Model

Receipt verification consumes a `receipt_verifications` row (already uploaded,
hashed, OCR'd) plus its parent `reviews` row and the `restaurants` /
`restaurant_branches` location. It produces a fraud risk score (0–100 persisted,
capped) and a decision, then synchronizes both rows' lifecycle states.

### Threshold source of truth

Constants live in `server/src/config/fraudRules.js`, exposed through a single
accessor `getFraudRules()`. Decision 0014 records the choice to ship constants
now and allow a DB-backed (`fraud_rule_configs`) source to replace the accessor
later without touching call sites. Domain functions receive the rules object as
a parameter (never read `process.env` or the DB directly), keeping them pure.

Constants (from Anti-Fraud §4.1, §6, ARCHITECTURE Anti-Fraud contract):

- `gpsNearRadiusMeters = 200`
- `gpsAccuracyMaxMeters = 100`
- `nearWindowMs = 3_600_000` (1h, measured server-side)
- `capturedAtSkewMaxMs = 300_000` (5 min)
- `merchantHighMatch = 80`, `merchantLowMatch = 60`
- `receiptFreshHours = 48`, `receiptStaleHours = 168`
- decision buckets: verified `0–30`, pendingAdmin `31–60`, referenceOnly `61–99`, reject `>=100`.

`fraud_risk_score` column is `CHECK (0..100)`. Internal scores can exceed 100
(duplicate=+100, plus other signals). We persist `min(score, 100)` but decide
from the **raw** score so the ≥100 reject bucket is reachable.

## Pure Functions (server/src/services/receiptVerificationScoring.js)

- `haversineMeters(lat1,lng1,lat2,lng2)` — R=6371000, returns meters.
- `normalizeMerchantName(name)` — NFD diacritic strip, lowercase, drop
  `Co.,Ltd` / `CN` / `chi nhánh` suffixes, strip non-alphanumeric, collapse
  whitespace. Used for both similarity and the canonical hash.
- `levenshteinSimilarity(a,b)` — `(1 - dist/maxLen)*100`, 0–100; two empty
  strings → 100; one empty → 0.
- `computeTransactionHash({name,datetimeISO,invoiceNo,totalAmount})` —
  `SHA256(normalizedName + "|" + datetimeISO + "|" + invoiceNo + "|" + totalAmount)`.
- `scoreReceipt(signals, rules)` → `{ score, breakdown }`. `breakdown` is an
  array of `{ code, points }`. Implements every §4.1 row from supplied signals.
- `decideFromScore(score, rules)` → `{ decision, reviewStatus, verificationStatus,
  receiptStatus, trustLabel, publicVisibility, trustWeightBucket }` — one row of
  Status_Mapping §3 per bucket.

### Scoring signal mapping (§4.1)

| Signal input | Points |
| --- | --- |
| gps absent / permission denied (`gpsProvided=false`) | +30 |
| gps accuracy > 100m | +15 |
| gps distance ≤200m | +0 |
| gps distance >200m AND submitted near (≤1h, trustworthy capturedAt) | +40 |
| gps distance >200m AND submitted late (>1h) or untrustworthy capturedAt | +10 |
| merchant similarity 80–100 | +0 |
| merchant similarity 60–79 | +25 |
| merchant similarity <60 | +60 |
| merchant name unreadable (`ocrRestaurantName` null/empty) | +50 |
| receipt ≤48h | +0 |
| receipt 49–168h | +40 |
| receipt >168h | +70 |
| receipt time unreadable | +30 |
| duplicate file hash | +100 |
| duplicate transaction hash | +100 |
| edited-metadata signal | +50 |
| new account <24h, first review | +15 |
| ≥3 rejected receipts in 7d | +40 |
| multi-account same device/IP same restaurant 24h | +50 |

GPS distance and merchant similarity are mutually exclusive buckets (exactly one
GPS-distance row, one merchant row, one timestamp row apply). When GPS is not
provided we add only the +30 absent penalty (no distance/accuracy rows).

## Orchestrator (server/src/services/receiptVerificationService.js)

`verifyReceipt(receiptVerificationId, { now } = {})`:

1. `BEGIN`. `SELECT ... FOR UPDATE` the receipt row; throw `NotFoundError` if
   missing. Load its review and restaurant (+ branch coords only when `branch_id`
   belongs to the receipt's `restaurant_id`, else restaurant coords).
2. Compute `transaction_unique_hash` from OCR fields when present.
3. Hard rule — composite duplicate: if a **different** receipt with the same
   `transaction_unique_hash` exists at `status='VERIFIED'`, reject:
   - receipt: status=REJECTED, decision=REJECTED, fraud_risk_score=100,
     transaction_unique_hash set, decision_reason.
   - review: status=REJECTED, verification_status=DUPLICATE_REJECTED,
     trust_label=REJECTED, public_visibility=PRIVATE, trust_weight_bucket=NONE.
   - `fraud_flags` (flag_code=`DUPLICATE_TRANSACTION_HASH`, risk_score=100,
     status=OPEN) + `fraud_flag_entities` (RECEIPT_VERIFICATION, REVIEW).
   - audit_logs row. COMMIT. Return.
4. Otherwise compute signals:
   - merchant similarity = `levenshteinSimilarity(normalize(ocr), normalize(restaurant.name))`,
     or unreadable when `ocr_restaurant_name` empty.
   - timestamp bucket from `ocr_receipt_time` vs server `created_at`.
   - GPS: `near` window from receipt `created_at` (server-side). If
     `gps_latitude/longitude` present, distance via haversine to venue; else
     gpsProvided=false. capturedAt skew >5 min ⇒ treat as late/untrustworthy.
   - persist `gps_distance_meters`, `ocr_similarity`.
5. `scoreReceipt` → raw score. `decideFromScore` → status set.
6. Update receipt + review to the decided states; persist
   `fraud_risk_score=min(raw,100)`, decision (VERIFIED/REJECTED/REFERENCE_ONLY,
   or NULL when PENDING_ADMIN_REVIEW since the column CHECK excludes it),
   decision_reason (breakdown summary).
7. On REJECTED with serious signals, create a `fraud_flags` row (flag_code from
   the dominant signal) + entities.
8. Always write an `audit_logs` decision row. COMMIT. Roll back on any error.

### Status writes per bucket (Status_Mapping §3)

| Bucket | review.status | review.verification_status | receipt.status | trust_label | public_visibility | trust_weight_bucket | receipt.decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0–30 | VERIFIED | VERIFIED | VERIFIED | VERIFIED | PUBLIC | HIGH | VERIFIED |
| 31–60 | PENDING_ADMIN_REVIEW | PENDING_ADMIN_REVIEW | PENDING_ADMIN_REVIEW | PENDING_ADMIN_REVIEW | PRIVATE_UNTIL_DECISION | NONE | NULL |
| 61–99 | REFERENCE_ONLY | REFERENCE_ONLY | REFERENCE_ONLY | REFERENCE_ONLY | PUBLIC | LOW | REFERENCE_ONLY |
| ≥100 | REJECTED | REJECTED | REJECTED | REJECTED | PRIVATE | NONE | REJECTED |
| dup hash | REJECTED | DUPLICATE_REJECTED | REJECTED | REJECTED | PRIVATE | NONE | REJECTED |

Note: `receipt.decision` CHECK allows only VERIFIED/REJECTED/REFERENCE_ONLY, so
PENDING_ADMIN_REVIEW leaves `decision` NULL (status column carries the state).
`trust_label`/`public_visibility`/`trust_weight_bucket` live on `reviews`, not
on the receipt row — matching the schema.

## Data Model

No schema change. All writes target existing columns. The duplicate-transaction
uniqueness is enforced logically here (a prior VERIFIED match → reject) and by
the partial unique index `idx_receipts_trx_uniq` as a backstop; we never insert
a second VERIFIED row with the same hash.

## Boundary Inputs

The orchestrator treats DB rows and OCR fields as untrusted: numeric coercion of
lat/lng/amount, null-guards on OCR strings, ISO normalization of
`ocr_receipt_time`, and server-side time for the 1h window. `capturedAt` is
metadata only and cannot lower risk when skew exceeds 5 minutes.

## Observability

Audit log is the product record of the decision (actor_id NULL for system,
actor_role `SYSTEM`, action `RECEIPT_VERIFICATION_DECISION`, previous/new status,
reason = score breakdown). Operational logging is out of scope here.

## Alternatives Considered

1. DB-tunable thresholds in `fraud_rule_configs` first — deferred (decision 0014)
   to keep this slice's blast radius bounded; accessor indirection makes the
   later swap non-breaking.
2. Capping the internal score at 100 before deciding — rejected: it would make
   the ≥100 reject bucket unreachable for non-duplicate signal stacks.
3. Storing trust_label on the receipt row — rejected: not in schema; those
   columns belong to `reviews`.
