# Design

## Domain Model

- Cognito remains the identity and account-provisioning authority.
- PostgreSQL `users` remains the profile and account-state authority.
- PostgreSQL `user_roles` remains the product authorization authority.
- Canonical manageable roles are `USER`, `ADMIN`, and `SUPER_ADMIN`.
- A created user always receives `USER`; admin roles require a later `SUPER_ADMIN` action.
- User deletion is not part of this story.

## Application Flow

1. Browser calls same-origin `/api/admin/users` routes.
2. Next.js reads the HttpOnly admin session cookie, adds the server-only BFF credential, and forwards the operation.
3. Express validates the BFF credential and opaque session marker.
4. Express re-reads actor status, deletion state, Cognito mapping, and local roles.
5. The admin user-management service validates input and target-tier rules.
6. PostgreSQL mutations run in transactions and write audit evidence.

Creation calls Cognito first with suppressed provider messaging and a verified email attribute. Express immediately sets a generated permanent provider password that is never returned, logged, or persisted by TrustBite; this moves the Cognito identity to `CONFIRMED` so the account can use the existing OTP/custom-auth flow without a temporary-password screen. The returned Cognito `sub` is persisted with the local user in one database transaction. If local persistence fails, Express attempts provider compensation by deleting the newly created Cognito identity and returns a safe failure.

## Interface Contract

Internal Express routes, available only through the BFF credential and opaque admin session:

- `GET /api/v1/admin-web/users`
- `POST /api/v1/admin-web/users`
- `GET /api/v1/admin-web/users/{userId}`
- `PATCH /api/v1/admin-web/users/{userId}`
- `POST /api/v1/admin-web/users/{userId}/suspend`
- `POST /api/v1/admin-web/users/{userId}/reactivate`

List query:

- `page`: integer, default `1`.
- `pageSize`: integer `1..100`, default `20`.
- `keyword`: bounded display-name, masked-phone, or UUID search.
- `status`: `ACTIVE`, `SUSPENDED`, or `DELETED`.
- `role`: `USER`, `ADMIN`, or `SUPER_ADMIN`.
- Sort is deterministic: `created_at DESC, id DESC`.

Create body:

- `email`: valid Cognito email, required.
- `displayName`: trimmed string up to 120 characters, required.
- `dateOfBirth`: valid `YYYY-MM-DD`, required.
- `phoneNumber`: unique E.164-compatible value, required.

Update body:

- `displayName`, `dateOfBirth`, `phoneNumber`: optional profile fields.
- `roles`: optional complete role set, accepted only for `SUPER_ADMIN`.
- `reason`: required, at least 10 characters, for role changes.

Contact data is masked in list responses. Detail responses include only the profile data needed for editing and never include Cognito tokens, raw session markers, or provider secrets.

## Data Model

- No new user columns.
- Seed canonical `USER`, `ADMIN`, and `SUPER_ADMIN` rows in `roles`.
- Reuse `users`, `user_roles`, `audit_logs`, `user_sessions`, and `push_tokens`.
- Role changes write `USER_ROLES_UPDATE` audit rows with previous/new roles in metadata.
- Creation writes `USER_CREATE` audit evidence without storing the email in PostgreSQL audit metadata.

## UI / Platform Impact

The existing `client/` admin portal replaces the locked user state with:

- summary counts;
- search and status/role filters;
- paginated responsive table;
- create dialog;
- detail/edit drawer or dialog;
- role editor visible only to `SUPER_ADMIN`;
- suspend/reactivate confirmation with reason and side-effect warning;
- loading, empty, error, retry, disabled, and success states.

No delete control is rendered.

## Observability

- Existing request error handling remains the operational boundary.
- Sensitive input is not logged.
- Mutations write product audit records.
- Provider compensation failure is reported as a server error without exposing provider payloads.

## Alternatives Considered

1. Send the opaque marker directly to existing bearer-token APIs. Rejected because it would violate decision `0022`.
2. Expose Cognito access tokens to browser JavaScript. Rejected because it expands XSS impact.
3. Create local-only users. Rejected because Cognito is the identity source of truth.
4. Hard-delete users from the admin portal. Rejected by policy and explicit human choice.
