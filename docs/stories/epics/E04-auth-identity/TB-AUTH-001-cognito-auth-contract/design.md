# Design

## Domain Model

- Cognito user: external identity managed by AWS Cognito User Pool.
- Cognito subject: stable external identity claim (`sub`) used to map a token to a TrustBite user.
- Cognito JWT: access or ID token issued and signed by Cognito. Protected APIs should normally accept access tokens unless a route explicitly documents a different token type.
- Local TrustBite user: PostgreSQL product user record that stores TrustBite profile/account fields and links to Cognito identity.
- Local account status: `ACTIVE`, `SUSPENDED`, or `DELETED`; enforced by TrustBite even when Cognito token signature is valid.

## Application Flow

1. Client signs up or logs in with Cognito.
2. Cognito issues JWTs.
3. Client calls Express business API with `Authorization: Bearer <Cognito JWT>`.
4. Auth middleware or API Gateway Cognito authorizer validates Cognito token signature and claims.
5. Express maps `sub` to a local TrustBite user, creating/linking only in flows that explicitly allow it.
6. Express rejects suspended/deleted users and users without required product role/permission.
7. Controller calls service/domain logic.

## Interface Contract

Protected routes must declare:

- `Authorization: Bearer <Cognito access token>` unless otherwise specified,
- required local account status and role/permission,
- auth errors for missing, invalid, expired, wrong client id, wrong issuer, wrong token use, unmapped identity, suspended/deleted account, and insufficient permission.

Business route/controller/service shape remains normal Express. Provider logic must stay in auth middleware/config/services and not inside domain services.

Auth implementation uses a provider adapter boundary:

```text
authMiddleware
  -> AuthService.authenticateRequest()
  -> configured identity provider adapter verifies token and returns normalized identity
  -> AuthService maps identity to local user and enforces status/roles
```

The normalized identity contains provider, subject, optional phone/email/local user id, phone verification state, token use, optional trusted local roles, provider diagnostics, and original claims for boundary diagnostics. Cognito groups are diagnostics only in this slice; TrustBite-local `user_roles` remains the product-role source of truth for `req.user.roles` and admin authorization.

Cognito remains the production adapter. Future providers require an accepted decision update and provider-specific negative-path proof.

## Data Model

The current schema stores local profile/account state in `users` and maps Cognito users through `users.cognito_sub`, a nullable stable subject with a uniqueness constraint when present. `users.phone_number` remains available for legacy/local mapping only when the provider reports a verified phone number and `users.cognito_sub` is still null during transition; Cognito `sub` is the preferred external identity key.

`user_sessions.refresh_token_hash` must not be used for Cognito refresh-token storage by default. Cognito owns session/refresh lifecycle.

Further identity schema changes require high-risk migration proof.

## UI / Platform Impact

- Web/mobile clients must target Cognito login/session semantics when auth UI is implemented.
- Local Express runs verify Cognito-compatible JWTs in middleware.
- API Gateway deployments may use a Cognito authorizer, but backend account status and business authorization remain enforced in Express.

## Observability

- Do not log raw access, ID, or refresh tokens.
- Do not log OTP codes or full sensitive identity values.
- Log auth failures using safe categories such as `missing_token`, `invalid_signature`, `expired_token`, `wrong_client_id`, `unmapped_identity`, `suspended_user`, or `forbidden`.
- Audit product authorization and account-state decisions where product policy requires it.

## Alternatives Considered

1. Backend-issued JWT and PostgreSQL refresh sessions first: rejected by decision 0010 because it duplicates Cognito and creates migration debt.
2. Generic auth abstraction before provider integration: rejected because Cognito is already selected and provider-specific JWT validation must be explicit.
3. API Gateway authorizer only: insufficient for current Express/local architecture and local account status checks.
4. Provider-neutral adapter boundary while keeping Cognito explicit: accepted by `docs/decisions/0011-auth-provider-adapter-boundary.md` because it keeps Cognito validation testable while limiting future provider replacement blast radius.
