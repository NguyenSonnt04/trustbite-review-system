# 0010 Cognito-First Auth Boundary

Date: 2026-06-11

## Status

Accepted

## Context

TrustBite is an AWS-oriented product that already names Cognito as the authentication provider in the project instructions, architecture notes, and auth backlog. Existing auth story notes conflicted with that direction by selecting a backend-issued JWT and PostgreSQL refresh-session lifecycle before Cognito. That would create a second identity/session system and later force migration of token issuer, refresh behavior, client contracts, and middleware assumptions.

Auth is a hard gate because it affects login, sessions, JWT verification, protected API behavior, account status enforcement, provider integration, and security validation.

## Decision

TrustBite uses Cognito from the start as the authentication and token-issuance source of truth.

- Cognito owns user authentication, hosted/custom auth flows, token issuance, refresh-token/session lifecycle, password/OTP/MFA flows where configured, and JWT signing keys.
- TrustBite Express remains the business API backend for restaurants, reviews, verification, trust score, profile product data, moderation, account status, and audit/security rules.
- Protected Express routes must verify Cognito JWTs in auth middleware before controllers call services.
- If a future deployment uses API Gateway, a Cognito authorizer may perform edge verification, but Express middleware must still consume trusted claims defensively and enforce TrustBite-local account state and business authorization.
- TrustBite persists product user records keyed to Cognito identity, for example `users.cognito_sub`, plus local status such as `ACTIVE`, `SUSPENDED`, or `DELETED`.
- TrustBite must not implement a generic backend-issued access-token/refresh-token/session layer first and then attach Cognito later. Backend-issued JWTs are allowed only for isolated test doubles or if a later accepted decision explicitly replaces Cognito as auth source of truth.

JWT middleware requirements:

- Validate issuer, audience/client id, token use, expiry, and signature against Cognito JWKS or trusted authorizer claims.
- Parse and validate unknown Cognito/JWT claims at the HTTP boundary.
- Map the Cognito subject to a local user record before protected business logic runs.
- Reject missing, invalid, expired, wrong-audience, wrong-token-use, suspended, or deleted users.
- Never log raw access, ID, or refresh tokens.

## Alternatives Considered

1. Backend-issued JWT plus PostgreSQL refresh sessions first, then Cognito later. Rejected because it duplicates Cognito, increases security ownership, and creates a migration path that conflicts with the accepted AWS provider direction.
2. Generic auth abstraction before provider selection. Rejected because Cognito is already the chosen provider and auth abstractions tend to hide provider-specific security claims that must be verified explicitly.
3. API Gateway Cognito authorizer only. Rejected as the sole boundary because the current implementation is an Express backend and local/business account checks still belong in backend middleware/services.

## Consequences

Positive:

- Auth contracts match the AWS/Cognito product direction from the first implementation slice.
- Express business APIs stay provider-aware only at the auth boundary and remain focused on TrustBite domain logic.
- Client and mobile integrations can target Cognito token semantics immediately.
- TrustBite avoids owning refresh-token rotation and password/OTP security unless a later decision explicitly changes provider ownership.

Tradeoffs:

- Local development needs Cognito-compatible configuration, LocalStack coverage where available, or explicit test doubles for JWT verification.
- Account suspension/deletion still requires TrustBite DB checks because Cognito tokens may remain valid until expiry.
- Provider-specific validation must be tested with negative cases instead of treated as a generic Bearer-token check.

## Supersedes

This decision supersedes `docs/decisions/0007-auth-session-token-strategy.md` for TrustBite auth/session ownership. The backend-issued JWT/PostgreSQL refresh-session strategy must not be used as the default auth path.

## Follow-Up

- Update auth story packets so TB-AUTH-001 is the Cognito contract and previous backend-session stories are superseded or rewritten.
- Update durable Harness matrix rows to remove Cognito-deferred language.
- Add implementation proof for Cognito JWT middleware negative paths and local account status rejection before marking auth implemented.
