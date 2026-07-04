# Verification / Anti-Fraud Product Contract

TrustBite verification is the backend-owned decision surface for determining whether review evidence is credible enough to affect verified review state and trust scoring.

## GPS Proximity Verification

GPS proximity checks compare the device-reported review location with the restaurant location using the Haversine formula.

Accepted rule for `TB-FRAUD-002`:

- Distance is computed in meters between two latitude/longitude coordinate pairs.
- The default GPS proximity threshold is **200 meters**.
- A proximity result passes when `distance_meters <= threshold_meters`.
- Latitude must be a finite number in `[-90, 90]`.
- Longitude must be a finite number in `[-180, 180]`.
- Threshold must be a finite positive number.
- Invalid coordinates or thresholds fail closed by throwing a validation error before any trust decision is made.

## Current Scope

`TB-FRAUD-002` only establishes the backend rule and unit proof. It does not yet persist GPS evidence, expose a public verification API, mutate review status, or update trust score. Those behaviors remain part of later review/verification stories.
