# Design

## Domain Model

- Cognito authenticates the administrator and issues the access token used for identity proof.
- PostgreSQL `users`, active deletion requests, and `user_roles` define whether that identity may enter the admin workspace.
- Redis owns a fixed-lifetime opaque browser-session marker. The marker is a random secret; Redis keys use only its SHA-256 digest.
- The browser owns only an HttpOnly cookie containing the opaque marker.

## Application Flow

1. The browser posts email and password to `POST /api/admin-auth/login` on the Next.js origin.
2. The Next.js route checks the request origin and forwards credentials to Express with a server-only BFF credential.
3. Express validates and throttles the request, calls Cognito `InitiateAuth`, and verifies the returned access token through the existing Cognito adapter.
4. Express maps the identity to the existing local user without provisioning a new user, rejects non-active/deletion-pending users, and requires a current local `ADMIN` or `SUPER_ADMIN` role.
5. Express revokes any Cognito refresh token, creates a Redis session bounded by the access-token expiry, and returns the opaque marker only to Next.js.
6. Next.js writes `trustbite_admin_session` as HttpOnly, SameSite Strict, path `/`, and Secure outside local development.
7. Next.js middleware validates the marker through Express before allowing `/admin/*`.
8. The admin UI reads a safe session profile through `GET /api/admin-auth/session`.
9. Logout calls Express revocation, then clears the cookie even if the backend is unavailable.

## Interface Contract

Express internal BFF endpoints:

- `POST /api/v1/auth/admin/web-session`
  - Body: `{ email, password }`.
  - Requires `x-trustbite-bff-secret`.
  - Returns `{ sessionToken, expiresAt, user }`.
- `GET /api/v1/auth/admin/web-session`
  - Requires `x-trustbite-bff-secret` and `x-trustbite-admin-session`.
  - Returns `{ expiresAt, user }`.
- `DELETE /api/v1/auth/admin/web-session`
  - Requires the same headers.
  - Returns `204` and is idempotent.

Stable negative codes include `BFF_AUTH_REQUIRED`, `INVALID_CREDENTIALS`, `AUTH_CHALLENGE_REQUIRED`, `ADMIN_ACCESS_REQUIRED`, `ADMIN_SESSION_INVALID`, `ADMIN_SESSION_EXPIRED`, `ACCOUNT_SUSPENDED`, `ACCOUNT_DELETED`, `DELETION_REQUEST_ACTIVE`, `LOGIN_RATE_LIMITED`, and provider/storage availability failures.

Next.js same-origin endpoints:

- `POST /api/admin-auth/login`.
- `GET /api/admin-auth/session`.
- `DELETE /api/admin-auth/logout`.

All auth responses use `Cache-Control: no-store`. Login returns generic user-safe errors for credential and account-enumeration failures.

## Data Model

No PostgreSQL migration is required. Redis values contain:

- schema version,
- local user id,
- Cognito subject,
- absolute expiry.

Redis stores no email, password, access token, ID token, or refresh token.

## UI / Platform Impact

- The landing-page login form becomes enabled with loading and safe error states.
- `/admin` renders the admin workspace after middleware validation.
- The workspace displays the verified local administrator name and role and includes logout.
- Legacy admin LocalStorage token and role inference is removed.

## Observability

- Never log email/password pairs, raw credentials, Cognito tokens, app-client secrets, BFF secrets, or opaque session markers.
- Internal errors expose stable safe codes, while unhandled infrastructure details remain server-side.
- Login throttling keys contain an HMAC or hash of normalized email plus a bounded IP component, not raw email.

## Alternatives Considered

See `docs/decisions/0022-admin-web-session-wrapper.md`.
