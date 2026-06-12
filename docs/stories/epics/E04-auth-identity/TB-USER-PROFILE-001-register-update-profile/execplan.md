# Exec Plan

## Goal

Implement TrustBite-local user profile read/update and local user mapping for Cognito-authenticated requests.

## Scope

In scope:

- Map Cognito-authenticated identities to local `users` rows by `users.cognito_sub`.
- Preserve verified-phone fallback only for transition users without `cognito_sub`.
- `GET /api/v1/users/me`.
- `PATCH /api/v1/users/me` for `displayName` and `avatarUrl` only.
- Reject profile update for `SUSPENDED`, `DELETED`, and active deletion-request users.

Out of scope:

- Cognito signup/login/forgot-password UX or provider commands; tracked by `TB-AUTH-CLIENT-001-cognito-signup-login-password-recovery`.
- Backend-issued OTP, access token, or refresh token flows.
- Avatar upload URL endpoint.
- UI/mobile changes.
- Additional profile fields outside schema.

## Risk Classification

Risk flags:

- Auth.
- Data model.
- Public contracts.
- Audit/security.

Hard gates:

- Auth.
- Data model.

## Work Phases

1. Done: Confirm schema/model fields including `users.cognito_sub`.
2. Done/partial: Bind users route behind auth middleware.
3. Done/partial: Implement user service mapping snake_case DB columns to API response.
4. Pending: Add automated proof for Cognito subject mapping, verified-phone transition fallback, unmapped identity rejection, and active deletion-request profile mutation rejection.
5. Pending: Validate DB insert/update rollback and suspended/deleted user behavior against migrated PostgreSQL.
6. Pending: Update Harness evidence when automated proof is complete.

## Stop Conditions

Pause if new user fields are requested or if arbitrary avatar URLs must be accepted contrary to OpenAPI.
