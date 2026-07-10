# Verification / Anti-Fraud Product Contract

TrustBite verification is the backend-owned decision surface for determining whether review evidence is credible enough to affect verified review state and trust scoring.

## GPS Proximity Verification

GPS proximity checks compare the device-reported review location with the restaurant location using the Haversine formula.

Accepted rule for `TB-FRAUD-002`:

- Distance is computed in meters between two latitude/longitude coordinate pairs.
- The default GPS proximity threshold is **200 meters** and is read from server anti-fraud configuration (`GPS_PROXIMITY_THRESHOLD_METERS`) so environments can tune it without changing service code.
- A proximity result passes when `distance_meters <= threshold_meters`.
- Latitude must be a finite number in `[-90, 90]`.
- Longitude must be a finite number in `[-180, 180]`.
- Threshold must be a finite positive number.
- Invalid coordinates or thresholds fail closed by throwing a validation error before any trust decision is made.

## Timestamp Evidence

Review `visitedAt` is optional, but when supplied it must be a valid ISO-8601 datetime and must not be in the future. The backend rejects future visit timestamps before creating the review.

Receipt `capturedAt` is optional client-supplied capture metadata. When supplied, the backend validates it as an ISO-8601 datetime, persists it as `receipt_verifications.captured_at`, and includes it in the receipt upload idempotency request hash. `capturedAt` is evidence for fraud review and retry consistency only; it must not be used by itself to reduce fraud risk or override server receive time/OCR-derived receipt time.

## Duplicate Receipt Hash

Receipt image SHA-256 hashes are unique for receipt verification records whose status is not `OCR_FAILED`. A matching non-failed hash is rejected as `DUPLICATE_RECEIPT_HASH` and creates a fraud flag for review.

## Behavioral, Velocity, and Device Signals

Accepted rules for `TB-FRAUD-005` (Anti-Fraud §4.1, §9). The backend derives these signals from persisted data during the receipt verification decision and adds them to the fraud risk score:

- **New account + first review**: when the reviewer account was created less than 24 hours ago and this is their first review, add `+15`.
- **Rejected-receipt velocity**: when the reviewer already has 3 or more `REJECTED` receipts in the trailing 7 days, add `+40`.
- **Multi-account same IP**: when another account uploaded a receipt from the same request IP for the same restaurant within the last 24 hours, add `+50`. This is the MVP IP-based device signal. The caller IP is captured server-side into `receipt_verifications.request_ip` (an optional, nullable `INET` column) and is treated as PII (never returned in API responses). A full client/mobile device-fingerprint SDK remains out of scope until a legal-basis/consent/retention decision exists.

These signals feed the same §4.2 decision buckets as the GPS/merchant/timestamp signals; a total score of `100+` still rejects and raises a fraud flag on the dominant signal. Daily hard rate limits (BR-RATE-003/004) are tracked separately and are not part of this rule set.

## Restaurant Trust Score

Accepted rule for `TB-TRUST-001` (Anti-Fraud §10, Status_Mapping §2). `restaurants.trust_score` (`1.00–5.00`) is a backend-computed weighted average of the restaurant's review ratings; the client never computes it.

- Each review contributes by its `trust_weight_bucket`: `HIGH` (verified) is weighted by the reviewer's rank (Newbie 0.5, Apprentice 0.8, Foodie 1.0, Trusted Foodie 1.5; unknown rank falls back to 0.5), `LOW` (reference) is weighted 0.1, and `NONE` (hidden/rejected/deleted/pending) is excluded.
- `trust_score = sum(rating_i * weight_i) / sum(weight_i)`, clamped to `1.00–5.00` and rounded to 2 decimals, where `rating_i` is the review's `average_rating`.
- A restaurant with no qualifying (HIGH/LOW) reviews resets to the neutral default `5.00`.
- The same pass recomputes `verified_review_count` (HIGH) and `reference_review_count` (LOW).

This is the restaurant trust score. TrustBite has no per-user trust score; user reputation is `exp_points`/`rank_code`. Auto-recompute triggers (verification decision, admin moderation, deletion) are a tracked follow-up.

## Vietnam Receipt Parsing

Textract `AnalyzeExpense` field names remain provider-defined, but mapped receipt
values must tolerate common Vietnam receipt formats:

- VND amounts may use dot or comma thousands separators and may include `VND`,
  `đ`, or other currency symbols.
- Receipt line-item quantities may be fractional with dot or comma decimal
  separators and must not be parsed with currency thousands heuristics.
- OCR receipt dates may arrive as ISO-like `yyyy-mm-dd` or Vietnam
  day-month-year forms such as `dd/MM/yyyy`.
- Client-supplied API timestamps such as `visitedAt` and `capturedAt` remain
  ISO-8601 strings at the HTTP boundary.

## OCR And Verification Scope

`TB-FRAUD-001` provides the backend OCR/receipt verification dependency for
Phase 4. The service loads private receipt objects through the provider
boundary, maps Textract expense fields where supported, persists OCR text and
line items, rejects duplicate receipt/transaction evidence, and synchronizes
receipt plus review states through backend rules.

`TB-REVIEW-001` owns the review-facing lifecycle around that dependency:
creating the initial review, uploading the receipt, enqueueing OCR after upload,
and exposing owner-scoped review/receipt status.

Known proof boundary: current automated proof uses mock-provider/local adapter
coverage for Textract behavior. A live AWS Textract end-to-end provider run is
not claimed by this backend closeout.
