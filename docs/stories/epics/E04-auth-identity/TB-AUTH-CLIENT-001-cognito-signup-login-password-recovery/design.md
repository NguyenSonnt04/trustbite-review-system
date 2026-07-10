# Design

## Domain Model

- Cognito is the identity provider and token/session source of truth.
- TrustBite stores product user state in PostgreSQL, keyed to `users.cognito_sub` after the local user is mapped.
- Express receives normalized identity from the configured identity provider adapter and exposes local user/account context as `req.user`.

## Application Flow

1. Client/mobile starts Cognito signup, login, or password-recovery flow.
2. Cognito performs configured OTP/password/MFA/password-reset behavior and issues tokens when successful.
3. Client/mobile stores and refreshes tokens according to Cognito SDK/platform guidance.
4. Client/mobile calls Express protected APIs with `Authorization: Bearer <Cognito access token>`.
5. Express verifies the access token through the Cognito adapter or consumes trusted authorizer claims at the deployment boundary.
6. Express maps the external identity to a local `users` row and enforces local `ACTIVE`/`SUSPENDED`/`DELETED` account state.

The Flutter mobile implementation uses `amplify_auth_cognito`. The default
`LoginScreen` accepts one email. It calls Cognito `SignUp` for a new email with
a memory-only generated password, handles Cognito signup confirmation, then
uses that same temporary credential once to bootstrap a Cognito session. An
existing confirmed email starts the configured custom-auth challenge. The
screen dispatches Cognito signup confirmation and custom challenge confirmation
through separate gateway operations, and resets a stale provider challenge to
the email entry state. Amplify remains the sole owner of the Cognito session
and token lifecycle. `TrustBiteApiClient` asks the Cognito session provider for
the current access token on every protected request instead of copying a token
into TrustBite's local session store.
Trusted-local metadata remains isolated in that local store and the development
signup endpoint is not a fallback for the Cognito button. Missing Cognito
runtime configuration fails closed with a user-visible configuration error.

## Interface Contract

- No new production Express auth issuance endpoint is added by this story.
- Protected Express APIs require `Authorization: Bearer <Cognito access token>` unless explicitly documented otherwise.
- Client/mobile auth integration must define the Cognito SDK calls, error mapping, and token handoff behavior before implementation.

Expected error categories at the TrustBite API boundary include missing credentials, invalid/expired token, unmapped identity, suspended/deleted account, and insufficient permission.

## Data Model

Uses `users.cognito_sub` for local identity mapping. Migration
`003_make_users_phone_optional_for_cognito_email_signup.sql` makes
`users.phone_number` nullable so email-first Cognito users can be provisioned
after their verified access token reaches the Express auth boundary. The
provisioning insert is transactional and only runs for the verified Cognito
provider identity, never for arbitrary client input.

## UI / Platform Impact

Mobile and web auth screens must target Cognito token semantics. Express remains the business API backend and must not own production password/OTP/token issuance.

## Observability

Do not log raw OTP codes, passwords, access tokens, ID tokens, refresh tokens, or full sensitive identity values. Client/mobile logs should report high-level auth outcome categories only.

## Alternatives Considered

1. Backend-owned OTP/login/refresh APIs: rejected because decisions `0010` and `0011` make Cognito the auth and token source of truth.
2. Delay auth provider selection and build a generic auth layer: rejected because TrustBite is already AWS/Cognito-oriented and provider-specific token validation must remain explicit.
