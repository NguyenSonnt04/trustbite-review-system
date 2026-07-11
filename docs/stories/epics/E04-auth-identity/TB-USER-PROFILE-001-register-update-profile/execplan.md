# Exec Plan

## Goal

Implement TrustBite-local user profile read/update and local user mapping for Cognito-authenticated requests.

## Scope

In scope:

- Map Cognito-authenticated identities to local `users` rows by `users.cognito_sub`.
- Preserve verified-phone fallback only for transition users without `cognito_sub`.
- `GET /api/v1/users/me`.
- `PATCH /api/v1/users/me` for `displayName`, `dateOfBirth`, `phoneNumber`, and `avatarUrl`.
- Required Flutter onboarding after Cognito auth and session restoration.
- Reject profile update for `SUSPENDED`, `DELETED`, and active deletion-request users.

Out of scope:

- Cognito signup/login/forgot-password UX or provider commands; tracked by `TB-AUTH-CLIENT-001-cognito-signup-login-password-recovery`.
- Backend-issued OTP, access token, or refresh token flows.
- Avatar upload URL endpoint.
- Additional profile fields beyond full name, date of birth, and phone.

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
4. Done: Add automated proof for Cognito subject mapping, verified-phone transition fallback, unmapped identity rejection, and active deletion-request profile mutation rejection.
5. Done: Validate DB insert/update rollback and suspended/deleted user behavior against migrated PostgreSQL.
6. Done: Update Harness evidence when automated proof is complete.
7. Done: Add date-of-birth migration and profile completion contract.
8. Done: Add Flutter onboarding for immediate and restored auth sessions.
9. Done: Prove timezone-safe DATE mapping, phone uniqueness, rollback, mobile
   routing, and APK build.

## Stop Conditions

Pause if additional demographic fields or arbitrary avatar URLs are requested.
