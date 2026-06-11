# 0011 Auth Provider Adapter Boundary

Date: 2026-06-11

## Status

Accepted

## Context

TrustBite currently uses Cognito as the authentication and token-issuance source of truth under decision `0010-cognito-first-auth-boundary.md`. The first auth/account API slice added Cognito JWT verification inside the Express auth service. The team also needs a safe path if TrustBite later replaces Cognito with another identity provider or an accepted custom auth system.

Auth remains high-risk because it affects JWT verification, provider claims, protected API behavior, local account status enforcement, roles, and security validation. Avoiding provider lock-in must not weaken the Cognito-first contract or reintroduce backend-issued OTP/access/refresh token ownership by accident.

## Decision

TrustBite keeps Cognito as the current auth and token-issuance provider, but Express auth code must isolate provider-specific token verification behind an identity provider adapter boundary.

The boundary is:

```text
Express auth middleware
  -> AuthService.authenticateRequest()
  -> configured identity provider adapter verifies provider token/claims
  -> AuthService maps normalized identity to local TrustBite user
  -> AuthService enforces local account status and roles
```

Provider adapters return a normalized identity object:

```text
provider: stable provider key, e.g. cognito
subject: provider subject/external user id
phoneNumber/email: optional mapped identity attributes
phoneNumberVerified: boolean indicating whether the provider verified the phone claim before it is used for transitional lookup
localUserId: test/deployment-only shortcut when explicitly trusted
roles: optional trusted roles from an authorizer/test double
tokenUse: verified token type
claims: original parsed claims for boundary diagnostics only
```

Rules:

- Cognito remains the only production adapter for the current implementation.
- Cognito-specific issuer, access-token `client_id`, `token_use`, `exp`, `nbf`, `sub`, JWKS, and signature validation stay explicit inside the Cognito adapter.
- Domain services and account/profile APIs consume `req.user` and must not parse provider JWT claims directly.
- Trusted local headers are a development/smoke-test adapter path only and remain disabled in production.
- Replacing Cognito later requires a new accepted decision or an update to this decision, provider-specific negative-path proof, and updated product/story docs.
- This boundary does not revive backend-owned OTP, access-token, refresh-token, or session issuance. Those remain retired unless a later accepted decision explicitly replaces Cognito/provider-owned auth.

## Alternatives Considered

1. Keep Cognito verification directly inside `AuthService`. Rejected because it couples local user mapping and account enforcement to one provider and makes future provider replacement more invasive.
2. Create a fully generic auth abstraction and hide provider claim details. Rejected because provider-specific JWT/security validation must remain explicit and testable.
3. Build TrustBite-owned OTP and JWT refresh sessions now. Rejected because it conflicts with decision `0010` and would reintroduce retired auth/session stories.

## Consequences

Positive:

- Current Cognito-first behavior remains intact.
- Future replacement of Cognito is localized to provider adapter/config/docs instead of profile/account domain services.
- Provider-specific security checks remain explicit and testable.
- Protected business APIs keep using TrustBite-local `req.user`, status, and role semantics.

Tradeoffs:

- Auth code has one extra indirection layer before there is a second production provider.
- Tests must cover both adapter-specific JWT verification and provider-neutral local user mapping.
- A future provider swap is still high-risk because token semantics, claims, and client login flows change.

## Follow-Up

- Add automated tests for Cognito adapter positive and negative JWT cases.
- Add integration tests for protected routes using normalized identity and local status rejection.
- If a non-Cognito provider is selected, create/update a high-risk story and decision before implementation.
