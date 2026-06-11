# Exec Plan

## Goal

Make Cognito-first authentication the accepted TrustBite auth contract and implementation path: Cognito owns auth/token/session lifecycle, Express owns business APIs, and protected routes verify Cognito JWTs in middleware/authorizer boundaries.

## Scope

In scope:

- Durable decision for Cognito-first auth boundary.
- Product docs for authentication and provider integration.
- Story packet defining implementation expectations.
- Harness matrix/durable row alignment.
- Superseding prior backend-issued JWT/session strategy.

Out of scope:

- Implementing Cognito JWT middleware.
- Provisioning Cognito user pools/app clients.
- Adding `users.cognito_sub` or equivalent schema migration.
- Building web/mobile login UI.
- Implementing API Gateway authorizer configuration.

## Risk Classification

Risk flags:

- Auth.
- Authorization.
- Audit/security.
- External systems.
- Public contracts.
- Data model, for future local user identity mapping.
- Weak proof.

Hard gates:

- Auth.
- Authorization.
- Audit/security.
- External provider behavior.

Lane: high-risk.

## Work Phases

1. Record intake as high-risk auth/provider contract work.
2. Add decision `0010-cognito-first-auth-boundary` superseding backend-issued JWT/session ownership.
3. Add product docs for authentication and provider integration.
4. Add TB-AUTH-001 story packet for Cognito auth contract.
5. Mark previous backend session story as superseded by TB-AUTH-001 / decision 0010.
6. Update Harness matrix and durable story row.
7. Validate docs/Harness commands and record trace.

## Stop Conditions

Pause for human confirmation if:

- Backend-issued production JWT/refresh-token sessions are requested again.
- Cognito is no longer the desired auth provider.
- Auth implementation is requested without a migration plan for local Cognito identity mapping.
- Validation requirements for JWT negative paths or secret/token logging are weakened.
