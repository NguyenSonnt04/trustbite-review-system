# Design

## Domain Model

- Access token: signed JWT with short TTL and minimal claims.
- Refresh token: opaque random token stored only as a hash in `user_sessions.refresh_token_hash`.
- Session: row in `user_sessions`, with optional `device_label`, `platform`, `revoked_at`, `expires_at`.

## Application Flow

1. OTP verify success creates/loads user.
2. If user status is `SUSPENDED` or `DELETED`, reject auth.
3. Create `user_sessions` row and set refresh cookie.
4. Return access JWT.
5. Refresh reads cookie, verifies hash/session, checks user status, rotates refresh token, and returns new access JWT.
6. Logout revokes session and clears cookie.

## Interface Contract

- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- Bearer JWT middleware for protected routes.

## Data Model

Uses existing `user_sessions` table. No new fields planned.

## UI / Platform Impact

Backend-only. Cookie security flags may need environment-aware local settings while preserving production defaults.

## Observability

Log session lifecycle events without raw tokens or full user PII.

## Alternatives Considered

1. Refresh JWT in response body: rejected by decision 0007.
2. Stateless refresh token: rejected because suspension/logout require revocation.
