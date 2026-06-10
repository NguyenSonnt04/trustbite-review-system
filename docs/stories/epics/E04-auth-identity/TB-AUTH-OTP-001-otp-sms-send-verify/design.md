# Design

## Domain Model

- OTP code: 6 numeric digits, never persisted or logged in plaintext outside explicit local/dev capture.
- OTP verification: persisted in `otp_verifications` with `phone_number`, `otp_hash`, `purpose`, `status`, `failed_attempts`, `expires_at`, `verified_at`.
- Redis keys:
  - `otp:req:<phone>` for request count in a 10-minute window.
  - `otp:fail:<phone>` for failed verify count.
  - `otp:lock:<phone>` for temporary phone lock.
  - optional local-only `otp:dev:last:<phone>` for safe test capture.

## Application Flow

1. Request OTP validates phone format.
2. Service checks Redis lock and rate limit.
3. Service creates OTP, hashes it, writes `otp_verifications` row, and calls SMS provider abstraction.
4. Verify OTP validates phone/code format.
5. Service checks Redis lock and failed counter. If Redis is unavailable, fail-closed with `503 PROVIDER_UNAVAILABLE` (same as `/auth/otp/request`). Otherwise loads latest pending OTP, verifies hash and expiry.
6. Success marks OTP verified and hands off to session/user flow.
7. Failure increments Redis failed counter and locks phone after threshold.

## Interface Contract

- `POST /api/v1/auth/otp/request`
- `POST /api/v1/auth/otp/verify`

Errors include `VALIDATION_ERROR`, `RATE_LIMITED`, `OTP_INVALID`, `OTP_EXPIRED`, `PROVIDER_UNAVAILABLE`.

## Data Model

No new table/field. May require seed migration for `otp_purposes` such as `LOGIN` with ttl 120 and max attempts 5.

## UI / Platform Impact

Backend-only. Local Docker must include Redis.

## Observability

Log request outcome and rate-limit decisions without OTP code, access token, refresh token, or full phone number.

## Alternatives Considered

1. PostgreSQL-only rate limit: rejected because TrustBite docs require Redis.
2. Real SMS provider in first slice: deferred until provider registration/config is ready.
