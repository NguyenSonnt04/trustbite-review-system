# 0007 Auth Session Token Strategy

Date: 2026-06-10

## Status

Superseded by `0010-cognito-first-auth-boundary.md`

## Context

TrustBite Phase 2 auth requires OTP login, access token, refresh/session lifecycle, profile APIs, and account safety controls. The product docs require secure session/refresh behavior, stable mobile API contracts, PostgreSQL-backed session revocation, and no logging of OTP/token secrets.

This decision was superseded because TrustBite now treats Cognito as the auth and token-issuance source of truth from day one. Express remains the business API backend and verifies Cognito JWTs in auth middleware/authorizer boundaries instead of issuing generic backend JWTs first.

## Decision

TrustBite will use:

- short-lived JWT access tokens for API bearer auth,
- opaque random refresh tokens delivered through `refresh_token` HttpOnly Secure SameSite=Strict cookie,
- `user_sessions.refresh_token_hash` as the only persisted refresh-token representation,
- refresh token rotation on successful refresh,
- session revocation on logout, account suspension, and account deletion request processing,
- auth middleware that rejects revoked/expired sessions and users with `users.status` of `SUSPENDED` or `DELETED`.

Refresh tokens are not JWTs and are not returned in JSON response bodies.

## Alternatives Considered

1. Refresh token as JWT in JSON response body: easier for client testing, but higher exposure risk and weaker server-side revocation semantics.
2. Access and refresh as opaque server sessions only: simpler revocation, but less aligned with existing Bearer access-token API contract.
3. Cognito-owned session lifecycle: originally deferred by this decision, but later accepted by decision 0010 as the TrustBite source of truth.

## Consequences

Positive:

- Backend can revoke sessions deterministically.
- Mobile clients keep access JWT handling simple while refresh token is protected from JavaScript-accessible storage.
- Schema matches existing `user_sessions.refresh_token_hash` without adding fields.

Tradeoffs:

- Cookie behavior must be tested carefully for local, mobile, and future web/admin clients.
- Refresh rotation needs integration proof to avoid stale-token replay bugs.

## Follow-Up

- Do not implement this backend-issued JWT/PostgreSQL refresh-session path unless a later accepted decision explicitly replaces Cognito.
- Use `docs/decisions/0010-cognito-first-auth-boundary.md` and the TB-AUTH-001 story packet for new auth work.
