# Overview

## Current Behavior

Backend auth/session code is placeholder only. No JWT issuance, refresh token rotation, middleware, or logout revocation exists.

## Target Behavior

OTP verification creates or loads a user, issues a short-lived access JWT, sets an opaque refresh token in a HttpOnly Secure SameSite cookie, and stores only a refresh-token hash in `user_sessions`. Refresh rotates the token. Logout and account suspension revoke sessions.

## Affected Users

- Authenticated users.
- Admins suspending users.
- Backend services enforcing protected routes.

## Affected Product Docs

- `trustbite-docs/04_Software_Engineering/API_Specification.md`
- `trustbite-docs/04_Software_Engineering/openapi.yaml`
- `trustbite-docs/02_Business_Analysis/Business_Rules.md`
- `docs/decisions/0007-auth-session-token-strategy.md`

## Non-Goals

- No UI changes.
- No refresh token in JSON response body.
- No Cognito-owned session flow in this slice.
