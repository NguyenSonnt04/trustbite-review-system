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

## Current Scope

`TB-FRAUD-002` only establishes the backend GPS proximity rule and unit proof. `TB-FRAUD-003` adds timestamp integrity and duplicate-hash proof for receipt/review creation. OCR extraction, receipt age scoring, GPS evidence persistence, public verification APIs, review status finalization, and trust score updates remain part of later review/verification stories.
