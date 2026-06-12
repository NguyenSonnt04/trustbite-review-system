# Overview

## Current Behavior

TrustBite uses a Cognito-first auth boundary. Express auth middleware verifies Cognito-compatible bearer JWTs through the Cognito identity provider adapter, maps the normalized identity to a local user, and enforces local account status and roles before protected routes run. Local smoke tests may use trusted headers only when explicitly enabled outside production.

## Target Behavior

Auth uses Cognito from day one. Clients authenticate with Cognito and call TrustBite Express APIs with Cognito bearer JWTs. Express remains the business API backend and verifies Cognito JWTs in auth middleware or consumes trusted Cognito-authorizer claims, then maps the Cognito subject to `users.cognito_sub` and enforces local account status/business authorization.

TrustBite does not implement a generic backend-issued auth/session layer first.

## Affected Users

- Guests signing up or logging in through Cognito-backed flows.
- Authenticated users calling protected review/profile APIs.
- Admins and moderators whose protected actions require trusted identity and local authorization.
- Backend/API developers implementing protected Express routes.

## Affected Product Docs

- `docs/product/authentication.md`
- `docs/product/provider-integrations.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_MATRIX.md`
- `docs/decisions/0010-cognito-first-auth-boundary.md`

## Non-Goals

- No UI/mobile auth screen work.
- No production Cognito pool provisioning in this slice.
- No additional identity-provider schema beyond the `users.cognito_sub` local mapping field.
- No backend-owned OTP/access/refresh token issuance.
