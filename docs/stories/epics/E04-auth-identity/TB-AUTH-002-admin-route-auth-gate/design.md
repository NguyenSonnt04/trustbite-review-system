# Admin Route Auth Gate Design

## Domain Model

Admin access requires both:

- a browser session marker for the `/admin` route middleware; and
- a local browser auth token plus `ADMIN` or `SUPER_ADMIN` role before the admin workspace loads dashboard data.

Cognito remains the token source of truth. This story does not introduce backend-issued TrustBite tokens.

## Application Flow

1. Anonymous visitor requests `/admin`.
2. Next.js middleware checks the admin session cookie scoped to `/admin`.
3. Missing cookie redirects to `/` with `redirect=/admin`.
4. If the admin shell renders, `AdminPortal` checks local token and admin role before calling health/restaurant APIs.
5. Logout clears local token/user state and the admin session cookie.

## Interface Contract

- `GET /admin`: requires `trustbite_admin_session` cookie; redirects to `/` when missing.
- `GET /api/v1/admin/session`: requires `Authorization: Bearer <Cognito access token>` or trusted local development headers, then requires `ADMIN` or `SUPER_ADMIN`; returns the authenticated admin user's safe profile fields.
- Home login form: requires email and password fields, calls `authService.login({ email, password })`, and displays the unsupported Cognito-web-login error.

## Data Model

No database schema or migration changes.

## UI / Platform Impact

- Removes the read-only admin bypass link.
- Keeps unavailable modules visibly locked.
- Keeps the admin workspace responsive but inaccessible without a session marker.

## Observability

No new logs or audit records. Future production admin login should add auth/audit proof under the Cognito auth story.

## Alternatives Considered

1. Full Cognito web login now: rejected because the existing product contract says Cognito owns auth, but this slice does not yet include a configured web Cognito client flow.
2. Server-generated TrustBite admin session: rejected because it would violate the Cognito-first auth boundary without a new accepted decision.
3. Cosmetic UI-only guard: rejected because it still lets anonymous visitors load `/admin`.
