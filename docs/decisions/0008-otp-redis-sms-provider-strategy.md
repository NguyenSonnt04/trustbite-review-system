# 0008 OTP Redis and SMS Provider Strategy

Date: 2026-06-10

## Status

Accepted

## Context

TrustBite OTP login is P0. Product docs require OTP rate-limit state and temporary phone locks to be kept in Redis, while PostgreSQL remains the application database for users, OTP evidence, and sessions. Production SMS provider selection must support OTP delivery without coupling route/controller code directly to provider SDKs.

## Decision

TrustBite will implement OTP with two storage roles:

- Redis stores OTP rate-limit counters, failed verification counters, temporary phone locks, and local/dev message capture when enabled.
- PostgreSQL stores OTP evidence in `otp_verifications` using hashed OTP values and persisted status.

The backend will introduce an SMS provider abstraction under `server/src/services/`:

- local/dev default: fake SMS provider or safe message capture,
- production target: AWS End User Messaging SMS, preferably Notify for managed OTP-style verification templates,
- optional LocalStack integration: SNS SMS only when needed for local/provider smoke proof.

If Redis is unavailable for OTP/rate-limit checks, auth endpoints fail closed with service/provider unavailable rather than bypassing rate limits.

## Alternatives Considered

1. PostgreSQL-only rate limits: simpler local setup but conflicts with accepted product docs and weaker low-latency abuse control.
2. Direct AWS SMS calls from controllers: simpler code path but violates provider-boundary rules.
3. Cognito custom auth as sole OTP provider: viable future direction but not selected for this backend slice.

## Consequences

Positive:

- OTP abuse rules are explicit and testable.
- Local development can validate OTP flows without sending real SMS.
- Provider swap remains isolated behind services.

Tradeoffs:

- Local Docker must include Redis from the first OTP implementation.
- Integration validation must include Redis availability and fail-closed behavior.

## Follow-Up

- Add Redis to local infrastructure.
- Document provider env vars before enabling real AWS SMS.
- Keep OTP codes, tokens, full phone numbers, and sensitive provider payloads out of logs and analytics.
