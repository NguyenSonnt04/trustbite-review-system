# 0019 Admin Web Session Wrapper

Date: 2026-07-14

## Status

Accepted

## Context

The admin web application needs password login without exposing Cognito access or refresh tokens to browser JavaScript. Decisions `0010` and `0011` require Cognito to remain the authentication, token, and provider-session authority, while decision `0012` requires PostgreSQL `user_roles` to remain the product authorization authority.

A browser-readable Cognito token would expand the impact of cross-site scripting. A cookie that is accepted based only on its presence would not prove identity, expiry, revocation, local account status, or current administrator role.

## Decision

TrustBite will use a short-lived opaque admin web-session wrapper with these boundaries:

- Express authenticates the submitted credentials through a dedicated Cognito app client using `USER_PASSWORD_AUTH`.
- The Cognito adapter verifies the returned access token before local mapping. Cognito remains the only issuer of the authenticated identity and token validity.
- Express maps the verified Cognito subject to the local user and requires an active account plus a current PostgreSQL `ADMIN` or `SUPER_ADMIN` role.
- Express immediately revokes any returned Cognito refresh token. The admin web session never refreshes Cognito credentials and cannot outlive the verified access-token expiry.
- Redis stores only a hash-addressed opaque session marker containing the local user id, Cognito subject, and absolute expiry. It stores no password or Cognito token.
- Next.js stores the opaque marker in a `Secure` production, `HttpOnly`, `SameSite=Strict` cookie and acts as the browser-facing BFF.
- Every protected admin navigation validates the marker through Express. Express re-reads local account, deletion-request, and role state on every validation, so suspension, deletion, role removal, expiry, logout, malformed state, Redis failure, or database failure fails closed.
- The web-session marker is not an Express business API access token. Existing protected business APIs continue to require verified Cognito bearer tokens unless a later accepted decision defines a server-side BFF proxy for a specific admin operation.
- Login and session endpoints require a server-only BFF credential, no-store responses, bounded input, and Redis-backed login throttling with both email-and-address and email-wide limits.

Production uses a dedicated Cognito app client with:

- `ALLOW_USER_PASSWORD_AUTH`,
- token revocation enabled,
- user-existence errors prevented,
- an app-client secret stored only in server secret configuration,
- a short access-token lifetime,
- no browser exposure of the app client secret or provider tokens.

## Alternatives Considered

1. Store Cognito access and refresh tokens in LocalStorage. Rejected because browser JavaScript and XSS could read long-lived administrator credentials.
2. Put a Cognito access token directly in an HttpOnly cookie. Rejected because middleware and browser-to-Express API boundaries would require broader token forwarding and CSRF handling, while logout and role changes would still need local validation.
3. Issue a TrustBite JWT or refresh token. Rejected because it would create a second token authority and conflict with the Cognito-first decisions.
4. Accept any non-empty session cookie. Rejected because it provides no integrity, expiry, revocation, role, or account-state proof.

## Consequences

Positive:

- Cognito remains the authentication and provider-session source of truth.
- Cognito tokens and passwords are never persisted in Redis, PostgreSQL, LocalStorage, or browser-readable cookies.
- Administrator role and account-state changes invalidate access on the next request.
- Middleware can enforce a real server-validated session rather than cookie presence.

Tradeoffs:

- Redis and PostgreSQL availability are required for every protected admin navigation.
- The admin must sign in again when the short fixed session expires.
- A dedicated Cognito app client and shared Next.js-to-Express BFF secret must be configured securely.

## Follow-Up

- Add a server-side BFF proxy decision before allowing the opaque marker to authorize admin business mutations.
- Add MFA challenge completion in a separate high-risk story if the dedicated app client requires Cognito challenges.
