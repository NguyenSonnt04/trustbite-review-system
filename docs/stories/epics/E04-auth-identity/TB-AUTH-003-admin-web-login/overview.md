# Overview

## Previous Behavior

The admin landing page disables its credential fields. `/admin/*` checks only whether `trustbite_admin_session` exists, so the cookie is not proof of authentication, expiry, revocation, account state, or role.

## Implemented Behavior

An administrator can submit email and password to a same-origin Next.js BFF route. Express authenticates through Cognito, verifies the returned access token, maps the identity to the local user, requires an active PostgreSQL-backed `ADMIN` or `SUPER_ADMIN` role, and creates a short-lived opaque Redis session. Next.js stores only that marker in an HttpOnly cookie. Protected admin navigation validates the session through Express and logout revokes it.

The implementation fails closed until an authorized operator provisions and configures the dedicated confidential Cognito admin app client.

## Affected Users

- TrustBite administrators.
- TrustBite super administrators.

## Affected Product Docs

- `docs/product/authentication.md`
- `docs/decisions/0010-cognito-first-auth-boundary.md`
- `docs/decisions/0011-auth-provider-adapter-boundary.md`
- `docs/decisions/0012-admin-roles-source-of-truth.md`
- `docs/decisions/0019-admin-web-session-wrapper.md`

## Non-Goals

- No TrustBite-issued access token, refresh token, or JWT.
- No browser storage of Cognito tokens.
- No use of Cognito groups as product administrator roles.
- No authorization of Express admin business mutations with the opaque web-session marker.
- No MFA or new-password challenge completion in this slice; an unresolved Cognito challenge fails closed with a safe message.
