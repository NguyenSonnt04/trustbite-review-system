# Exec Plan

## Goal

Implement backend user registration through OTP verification and current-user profile read/update APIs.

## Scope

In scope:

- Create user on OTP verify if phone does not exist.
- `GET /api/v1/users/me`.
- `PATCH /api/v1/users/me` for `displayName` and `avatarUrl` only.
- Reject profile update for `SUSPENDED` and `DELETED` users.

Out of scope:

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

1. Confirm schema/model fields.
2. Implement user repository/service mapping snake_case DB columns to API response.
3. Bind users route and auth middleware.
4. Validate DB insert/rollback and suspended-user behavior.
5. Update Harness evidence.

## Stop Conditions

Pause if new user fields are requested or if arbitrary avatar URLs must be accepted contrary to OpenAPI.
