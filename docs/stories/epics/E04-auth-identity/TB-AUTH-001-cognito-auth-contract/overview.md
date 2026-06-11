# Overview

## Current Behavior

TrustBite docs and Harness records were inconsistent. Project instructions and backlog named Cognito as the auth provider, while prior session story notes selected backend-issued JWT and PostgreSQL refresh sessions before Cognito. Backend auth code is still a placeholder and does not yet verify Cognito JWTs.

## Target Behavior

Auth uses Cognito from day one. Clients authenticate with Cognito and call TrustBite Express APIs with Cognito bearer JWTs. Express remains the business API backend and verifies Cognito JWTs in auth middleware or consumes trusted Cognito-authorizer claims, then maps the Cognito subject to a local user and enforces local account status/business authorization.

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

- No implementation in this docs alignment slice.
- No UI/mobile auth screen work.
- No production Cognito pool provisioning in this slice.
- No schema migration in this slice, even though local user mapping likely needs a future `users.cognito_sub` or equivalent field.
