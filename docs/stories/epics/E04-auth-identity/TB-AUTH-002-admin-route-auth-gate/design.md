# Admin Route Auth Gate Design

## Domain Model

Admin access requires a browser session marker for the `/admin` route middleware. Browser JavaScript must not create that marker or place bearer tokens in cookies; future Cognito web login must exchange a verified Cognito token through a server boundary that sets an HttpOnly/Secure session marker.

Cognito remains the token source of truth. This story does not introduce backend-issued TrustBite tokens.

## Application Flow

1. Anonymous visitor requests `/admin` or `/admin/preview`.
2. Next.js middleware checks for the admin session marker on every admin path.
3. Missing cookie redirects to `/` with the requested admin path in `redirect`.
4. Future Cognito web login must set the admin session marker only from a server response with `HttpOnly; Secure`.
5. Admin user-status mutations validate the `reason` request field before service-layer logic runs.

## Interface Contract

- `GET /admin` and `GET /admin/*`: require the `trustbite_admin_session` marker; redirect to `/` when missing.
- `GET /api/v1/admin/session`: requires `Authorization: Bearer <Cognito access token>` or trusted local development headers, then requires `ADMIN` or `SUPER_ADMIN`; returns the authenticated admin user's safe profile fields.
- `POST /api/v1/admin/users/:userId/suspend` and `/reactivate`: require a JSON `reason` string no longer than 500 characters at the controller boundary before service validation enforces the existing business minimum.
- Home login form: remains disabled until a safe Cognito web login flow can set a server-owned HttpOnly/Secure session marker.

## Data Model

No database schema or migration changes.

## UI / Platform Impact

- Removes public admin bypass links.
- Keeps unavailable modules visibly locked.
- Keeps the admin workspace responsive but inaccessible without a server-owned session marker.

## Observability

No new logs or audit records. Future production admin login should add auth/audit proof under the Cognito auth story.

## Alternatives Considered

1. Full Cognito web login now: rejected because the existing product contract says Cognito owns auth, but this slice does not yet include a configured web Cognito client flow.
2. Server-generated TrustBite admin session: rejected because it would violate the Cognito-first auth boundary without a new accepted decision.
3. Cosmetic UI-only guard: rejected because it still lets anonymous visitors load `/admin`.
