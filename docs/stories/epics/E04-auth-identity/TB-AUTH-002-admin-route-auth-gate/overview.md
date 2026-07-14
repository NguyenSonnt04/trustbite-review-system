# Admin Route Auth Gate Overview

## Current Behavior

The `/admin` web route rendered the admin workspace without a route-level session gate, and the home login form did not pass submitted credentials into the auth service.

## Target Behavior

The `/admin` and `/admin/*` routes are blocked by Next.js middleware unless an admin session cookie is present. The cookie is not written by browser JavaScript; future Cognito web login must have the server set an HttpOnly/Secure session marker after verifying the Cognito token. The backend exposes a protected `GET /api/v1/admin/session` role-check endpoint for future web auth wiring. Unsupported login and public preview entry points stay locked instead of offering a read-only bypass.

## Affected Users

- TrustBite operations/admin users.
- Anonymous web visitors who must not access admin routes.

## Affected Product Docs

- `docs/product/authentication.md`
- `docs/ARCHITECTURE.md`

## Non-Goals

- Implement a new backend-issued session, JWT, refresh token, or password flow.
- Implement full Cognito hosted/custom web login.
- Add new admin backend APIs.
