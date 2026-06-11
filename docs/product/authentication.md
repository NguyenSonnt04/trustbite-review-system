# Authentication

## Product Contract

TrustBite uses AWS Cognito from day one for authentication and token issuance. Do not implement a generic backend-auth/session layer first and then attach Cognito later.

Cognito owns:

- signup and login flows,
- configured OTP/password/MFA or hosted/custom auth behavior,
- access, ID, and refresh token issuance,
- token/session lifecycle,
- JWT signing keys and JWKS rotation.

TrustBite Express owns:

- business APIs for restaurants, reviews, verification, trust score, profiles, moderation, and account state,
- provider-specific JWT verification at the auth boundary when API Gateway is not already enforcing it,
- defensive consumption of trusted authorizer claims when API Gateway enforces Cognito,
- mapping normalized external identities to local TrustBite users,
- local account status checks,
- product authorization and audit/security rules.

## Auth Boundary

Protected API requests use this boundary:

```text
Client authenticates with Cognito
  -> Client receives Cognito JWTs
  -> Client calls TrustBite Express API with Authorization: Bearer <Cognito access token>
  -> Express auth middleware or deployed authorizer verifies Cognito JWT through the configured identity provider adapter
  -> Express normalizes provider claims into an external identity
  -> Express maps external identity to a local TrustBite user
  -> Express checks local account status and business authorization
  -> Controllers/services run product logic
```

The backend must not issue production access/refresh tokens for TrustBite users unless a later accepted decision explicitly replaces Cognito as the authentication source of truth.

The current production identity provider adapter is Cognito. `docs/decisions/0011-auth-provider-adapter-boundary.md` documents the adapter boundary so profile and account services do not parse Cognito claims directly.

## JWT Verification Requirements

Express auth middleware/authorizer handling must validate:

- JWT signature against Cognito JWKS or trusted authorizer claims,
- issuer for the configured Cognito user pool,
- audience/client id for the configured app client,
- `token_use` expected for the protected API,
- `exp`, `nbf`, and time-based validity,
- required identity claims such as `sub`, and optional email/phone claims when used.

Reject requests when:

- the token is missing, malformed, expired, wrong issuer, wrong audience, wrong token use, or has an invalid signature,
- the Cognito subject cannot be mapped to an allowed TrustBite user for routes that require a local account,
- the local user has `status = SUSPENDED` or `status = DELETED`,
- the user lacks the product role/permission for the requested action.

Never log raw access tokens, ID tokens, refresh tokens, OTP codes, or full sensitive identity values.

## Local User State

Cognito is the identity/session source of truth. PostgreSQL stores TrustBite product state.

Expected local user mapping:

- store Cognito identity as a stable external subject, for example `users.cognito_sub`, once the schema story is selected,
- keep product fields such as display name, avatar URL, rank, review restrictions, and account deletion state in PostgreSQL,
- keep local status checks (`ACTIVE`, `SUSPENDED`, `DELETED`) in backend middleware/services because a Cognito token can remain valid until expiry.

Existing schema fields must not be treated as final if they do not yet contain Cognito identity mapping. Schema changes require a high-risk story and migration proof.

## API Contract Rules

Business APIs remain normal Express routes/controllers/services. Auth is a boundary concern, not a reason to move business logic into Cognito.

Protected route documentation must state:

- whether a Cognito bearer token is required,
- which token type is accepted,
- which local role/status checks apply,
- success response shape,
- negative auth/authorization errors.

Standard auth errors should distinguish at least:

- missing credentials,
- invalid/expired token,
- unmapped identity,
- suspended/deleted account,
- insufficient permission.

## Local Development And Testing

Local development may use LocalStack Cognito where supported or an explicit Cognito-compatible test double. Test doubles must preserve Cognito claim semantics and must not become a production auth path.

Auth implementation cannot be marked complete until proof covers positive and negative JWT cases, local account status rejection, no-token logging, and provider/local configuration safety.

## Source Of Truth

- Decision: `docs/decisions/0010-cognito-first-auth-boundary.md`.
- Provider adapter boundary: `docs/decisions/0011-auth-provider-adapter-boundary.md`.
- Primary story: `docs/stories/epics/E04-auth-identity/TB-AUTH-001-cognito-auth-contract/`.
- Architecture boundary: `docs/ARCHITECTURE.md`.
