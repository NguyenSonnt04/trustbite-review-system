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
- auth errors for missing, invalid, expired, wrong audience, wrong issuer, wrong token use, unmapped identity, suspended/deleted account, and insufficient permission.

Business route/controller/service shape remains normal Express. Provider logic must stay in auth middleware/config/services and not inside domain services.

## Data Model

Current migration has `users.phone_number` and `user_sessions`, but no Cognito identity mapping field. Future implementation should add an explicit Cognito identity mapping such as `users.cognito_sub` with uniqueness proof, or a separate identity table if a later decision requires multi-provider identity.

`user_sessions.refresh_token_hash` must not be used for Cognito refresh-token storage by default. Cognito owns session/refresh lifecycle.

Schema changes are out of scope for this docs alignment and require high-risk migration proof.

## UI / Platform Impact

- Web/mobile clients must target Cognito login/session semantics when auth UI is implemented.
- Local Express runs verify Cognito-compatible JWTs in middleware.
- API Gateway deployments may use a Cognito authorizer, but backend account status and business authorization remain enforced in Express.

## Observability

- Do not log raw access, ID, or refresh tokens.
- Do not log OTP codes or full sensitive identity values.
- Log auth failures using safe categories such as `missing_token`, `invalid_signature`, `expired_token`, `wrong_audience`, `unmapped_identity`, `suspended_user`, or `forbidden`.
- Audit product authorization and account-state decisions where product policy requires it.

## Alternatives Considered

1. Backend-issued JWT and PostgreSQL refresh sessions first: rejected by decision 0010 because it duplicates Cognito and creates migration debt.
2. Generic auth abstraction before provider integration: rejected because Cognito is already selected and provider-specific JWT validation must be explicit.
3. API Gateway authorizer only: insufficient for current Express/local architecture and local account status checks.
