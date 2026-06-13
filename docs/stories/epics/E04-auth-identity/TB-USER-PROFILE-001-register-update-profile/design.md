# Design

## Domain Model

- User profile fields from schema: `id`, `phone_number`, `display_name`, `avatar_url`, `status`, `exp_points`, `rank_code`, timestamps.
- Cognito identity is stored on `users.cognito_sub` and is the stable external identity key for mapped local users.
- API uses camelCase response fields such as `phoneNumber`, `displayName`, `avatarUrl`, `rankCode`, `expPoints`.
- Role is derived from `user_roles`/`roles` when needed; `users.role` is not a schema field.

## Application Flow

1. Cognito authenticates the user and issues provider tokens.
2. Express auth middleware verifies a Cognito access token through the identity provider adapter.
3. Express maps the normalized identity to a local user by `users.cognito_sub`.
4. During transition only, a verified provider phone number may bind a local user with matching `phone_number` and empty `cognito_sub`.
   - The transition fallback is enabled by default only in local development and test for the accepted transition period; explicit `AUTH_PHONE_FALLBACK_ENABLED=false` disables it as a kill switch.
   - Before enabling the fallback outside local/test environments, a backfill script must dry-run and then bind known legacy rows to Cognito subjects from a trusted provider export or migration source; the script must report unmatched and duplicate phone numbers without mutating them.
   - Runtime fallback may bind only when exactly one local row matches the normalized verified phone and has `cognito_sub IS NULL`. Zero matches, multiple matches, unverified phone claims, or rows that already have a different `cognito_sub` fail closed as unmapped identity and require manual migration cleanup.
   - Production-like environments default the fallback off; explicit `AUTH_PHONE_FALLBACK_ENABLED=true` is allowed only after the backfill proof above. The transition ends after backfill completion plus one release with zero production fallback binds; changing the default on outside local/test requires a new accepted high-risk decision/story update.
5. `GET /users/me` returns current user profile.
6. `PATCH /users/me` validates body and updates only `display_name`/`avatar_url`.
7. `SUSPENDED`, `DELETED`, and active deletion-request users are rejected for profile mutation.

## Interface Contract

- `GET /api/v1/users/me`.
- `PATCH /api/v1/users/me`.

## Data Model

Uses existing `users` and optional `user_roles` joins. No schema field additions.

## UI / Platform Impact

Backend-only. Client/mobile signup, login, forgot-password, and token handoff are tracked by `TB-AUTH-CLIENT-001-cognito-signup-login-password-recovery`.

## Observability

Do not log full phone number or arbitrary avatar URLs beyond operational error context.

## Alternatives Considered

1. Create local users from backend OTP verification: rejected for this story because Cognito owns auth flows and backend OTP is retired.
2. Add profile table: rejected; current schema has profile fields on `users`.
3. Accept arbitrary avatar URL: rejected by OpenAPI allowlist requirement.
