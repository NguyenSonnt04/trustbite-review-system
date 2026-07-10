# Overview

## Current Behavior

`GET /api/v1/users/me` and `PATCH /api/v1/users/me` exist behind the Express auth middleware. They read and update schema-backed TrustBite profile fields for the already-mapped local user. Cognito signup/login/password recovery remains provider-owned and is not part of this story.

## Target Behavior

After a Cognito-authenticated request is accepted, Express maps the verified
external identity to a local `users` row. Authenticated users can read and
update display name, date of birth, phone number, and avatar URL. Mobile
requires display name, date of birth, and phone before entering Home, including
when restoring a Cognito session. Suspended/deleted users and users with active
deletion requests cannot mutate profile.

## Affected Users

- Authenticated users.
- Suspended users.
- Mobile/API clients consuming `/users/me`.

## Affected Product Docs

- `trustbite-docs/04_Software_Engineering/API_Specification.md`
- `trustbite-docs/04_Software_Engineering/openapi.yaml`
- `trustbite-docs/06_Database_Design/PostgreSQL_Database_Schema.md`
- `trustbite-docs/06_Database_Design/Backend_Model_Guide.md`

## Non-Goals

- No avatar upload URL implementation in this story.
- No address, gender, government ID, or additional demographic fields.
- No Cognito signup, login, forgot-password, OTP, or token issuance implementation; those are covered by `TB-AUTH-CLIENT-001-cognito-signup-login-password-recovery`.
