# 0008 OTP Redis and SMS Provider Strategy

Date: 2026-06-10

## Status

Superseded by `0010-cognito-first-auth-boundary.md` for default TrustBite authentication. Retained only as historical/provider design if a later accepted decision reintroduces backend-owned OTP.

## Context

TrustBite OTP login was previously treated as a backend-owned auth slice. Product docs required OTP rate-limit state and temporary phone locks to be kept in Redis, while PostgreSQL remained the application database for users, OTP evidence, and sessions. Production SMS provider selection needed to support OTP delivery without coupling route/controller code directly to provider SDKs.

Decision `0010-cognito-first-auth-boundary.md` now makes Cognito the auth and token-issuance source of truth from day one, including OTP/MFA behavior where configured. This decision is no longer the default implementation direction for TrustBite authentication.

## Decision

TrustBite will implement OTP with two storage roles:

- Redis stores OTP rate-limit counters, failed verification counters, temporary phone locks, and local/dev message capture only when `OTP_CAPTURE_MODE=redis` and `NODE_ENV` is explicitly allowlisted as `development` or `test`.
- PostgreSQL stores OTP evidence in `otp_verifications` using hashed OTP values and persisted status.

The backend will introduce an SMS provider abstraction under `server/src/services/`:

- local/dev default: fake SMS provider or safe message capture guarded by `OTP_CAPTURE_MODE=redis` and `NODE_ENV` in `development`/`test`,
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

- Local Docker includes Redis so OTP implementation can validate rate-limit, lock, and fail-closed behavior before runtime code is marked complete.
- Integration validation must include Redis availability and fail-closed behavior.

## Follow-Up

- Do not implement backend-owned OTP as the default auth path unless a later accepted decision replaces Cognito or scopes backend OTP to a non-auth notification use case.
- If reintroduced, wire backend Redis client/config to the local `redis` service during that implementation story.
- Keep OTP codes, tokens, full phone numbers, and sensitive provider payloads out of logs and analytics.
