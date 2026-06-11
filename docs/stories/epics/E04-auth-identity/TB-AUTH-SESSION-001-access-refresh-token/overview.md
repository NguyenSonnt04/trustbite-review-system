# Overview

## Status

Superseded by `docs/decisions/0010-cognito-first-auth-boundary.md` and `docs/stories/epics/E04-auth-identity/TB-AUTH-001-cognito-auth-contract/`.

## Current Behavior

Backend auth/session code is placeholder only. No Cognito JWT verification middleware, local Cognito identity mapping, or protected-route enforcement exists.

Earlier notes in this packet described backend-issued JWT access tokens, opaque refresh cookies, and PostgreSQL `user_sessions` refresh-token rotation. That direction is no longer the TrustBite auth source of truth.

## Target Behavior

Use Cognito from the start. Cognito owns authentication, token issuance, and refresh/session lifecycle. Express remains the business API backend and verifies Cognito JWTs in middleware or through a Cognito authorizer boundary, then enforces local user mapping, account status, and business authorization.

## Affected Users

- Authenticated users.
- Admins suspending users.
- Backend services enforcing protected routes.

## Affected Product Docs

- `docs/product/authentication.md`
- `docs/product/provider-integrations.md`
- `docs/decisions/0010-cognito-first-auth-boundary.md`
- `docs/stories/epics/E04-auth-identity/TB-AUTH-001-cognito-auth-contract/`

## Non-Goals

- Do not implement backend-issued production JWT/refresh-token sessions.
- Do not use `user_sessions.refresh_token_hash` as a Cognito refresh-token store by default.
- Do not treat this superseded packet as implementation guidance unless a later accepted decision replaces Cognito.
