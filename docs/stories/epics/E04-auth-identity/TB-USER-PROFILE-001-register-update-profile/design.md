# Design

## Domain Model

- User profile fields from schema: `id`, `phone_number`, `display_name`, `avatar_url`, `status`, `exp_points`, `rank_code`, timestamps.
- API uses camelCase response fields such as `phoneNumber`, `displayName`, `avatarUrl`, `rankCode`, `expPoints`.
- Role is derived from `user_roles`/`roles` when needed; `users.role` is not a schema field.

## Application Flow

1. OTP verify success checks `users.phone_number`.
2. Missing user is created with default status/rank.
3. `GET /users/me` returns current user profile.
4. `PATCH /users/me` validates body and updates only `display_name`/`avatar_url`.
5. `SUSPENDED` and `DELETED` users are rejected for profile mutation.

## Interface Contract

- `GET /api/v1/users/me`.
- `PATCH /api/v1/users/me`.

## Data Model

Uses existing `users` and optional `user_roles` joins. No schema field additions.

## UI / Platform Impact

Backend-only.

## Observability

Do not log full phone number or arbitrary avatar URLs beyond operational error context.

## Alternatives Considered

1. Add profile table: rejected; current schema has profile fields on `users`.
2. Accept arbitrary avatar URL: rejected by OpenAPI allowlist requirement.
