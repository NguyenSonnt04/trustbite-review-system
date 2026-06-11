# Design

## Status

Superseded by decision `0010-cognito-first-auth-boundary`.

## Superseded Design

The previous design for backend-issued JWT access tokens, opaque refresh-token cookies, PostgreSQL `user_sessions.refresh_token_hash`, refresh rotation, and logout/session revocation is not the default TrustBite auth design.

## Current Design Direction

- Cognito owns authentication, token issuance, and refresh/session lifecycle.
- Express protected routes verify Cognito JWTs in auth middleware or consume trusted Cognito-authorizer claims.
- Express maps Cognito `sub` to a local TrustBite user.
- Express rejects local `SUSPENDED` and `DELETED` users and enforces product authorization.
- PostgreSQL stores product user/account state, not Cognito refresh tokens.

## Data Model

A future schema story should add explicit Cognito identity mapping such as `users.cognito_sub` or a separate identity table. That migration is not defined by this superseded packet.

## Alternatives Considered

1. Backend-issued JWT and refresh sessions: rejected by decision 0010.
2. Cognito-first with Express middleware/authorizer boundary: accepted by decision 0010.
