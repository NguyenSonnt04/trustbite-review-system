# Exec Plan

## Goal

Implement backend access JWT and refresh/session lifecycle using opaque HttpOnly refresh tokens and PostgreSQL session revocation.

## Scope

In scope:

- Access JWT issuance and verification.
- Opaque refresh token cookie.
- `user_sessions.refresh_token_hash` persistence.
- Refresh rotation.
- Logout/session revoke.
- Rejection for `SUSPENDED` and `DELETED` users.

Out of scope:

- UI/mobile secure storage work.
- Cognito session ownership.
- Password/social auth.

## Risk Classification

Risk flags:

- Auth.
- Data model.
- Audit/security.
- Public contracts.
- Weak proof.

Hard gates:

- Auth.
- Audit/security.

## Work Phases

1. Confirm token strategy decision.
2. Add auth config/env validation.
3. Implement session service and middleware.
4. Integrate OTP verify, refresh, and logout.
5. Validate DB migration and rollback proof.
6. Validate suspended/deleted user rejection.

## Stop Conditions

Pause if refresh token is requested in JSON body, if refresh JWT is required, or if schema fields outside current tables become necessary.
