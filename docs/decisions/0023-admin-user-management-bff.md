# 0023 Admin User Management BFF

Date: 2026-07-15

## Status

Accepted

## Context

The admin portal needs user list, detail, creation, profile updates, role management, suspension, and reactivation. Decision `0022` deliberately prevents the browser's opaque admin session marker from being used as a bearer token for Express business APIs. Browser-readable Cognito credentials and local-only identity creation are also prohibited.

## Decision

TrustBite will expose a narrow server-side admin user-management BFF:

- The browser calls same-origin Next.js route handlers.
- Next.js reads the HttpOnly opaque marker and forwards it with the server-only BFF credential.
- Express validates both boundaries and revalidates local account state and local admin roles for every request.
- Internal admin-web user routes are not authorized by Cognito groups or by the marker alone.
- Cognito pre-provisions email identities with messaging suppressed, then Express sets an undisclosed generated permanent provider password to move them to `CONFIRMED` for the existing OTP/custom-auth flow; PostgreSQL stores the mapped profile and product roles.
- PostgreSQL `user_roles` remains authoritative. Only `SUPER_ADMIN` can manage admin roles.
- User creation, profile mutation, role mutation, suspension, and reactivation write audit evidence.
- The admin portal exposes no delete action. Account deletion remains a separate privacy and retention workflow.

## Alternatives Considered

1. Expose Cognito access tokens to browser JavaScript. Rejected because XSS could read administrator credentials.
2. Accept the opaque marker on all Express business routes. Rejected because it broadens a fixed-purpose session wrapper into a second general token authority.
3. Create local-only users. Rejected because Cognito is the identity source of truth.
4. Hard-delete users. Rejected because it conflicts with account-deletion retention and audit rules.

## Consequences

Positive:

- Browser JavaScript receives no Cognito token, BFF secret, or session marker.
- Every operation rechecks current account and role state.
- Admin user management follows one explicit provider/local consistency contract.
- Existing bearer-token business APIs remain unchanged.

Tradeoffs:

- Next.js and Express require matching BFF configuration.
- Provider creation needs compensation when local persistence fails.
- Admin user creation depends on Cognito availability.

## Follow-Up

- Add MFA completion as a separate story if the admin Cognito client requires challenges.
- Add email-editing only after a separate provider ownership and verification decision.
