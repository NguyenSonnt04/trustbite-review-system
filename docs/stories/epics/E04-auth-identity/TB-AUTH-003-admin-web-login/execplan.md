# Exec Plan

## Goal

Deliver a fail-closed Cognito-backed admin web login, session validation, and logout flow without exposing provider tokens to the browser.

## Scope

In scope:

- Dedicated Cognito admin app-client configuration contract.
- Cognito password authentication and access-token verification.
- Local administrator role and account-state validation.
- Opaque Redis web-session creation, validation, expiry, and revocation.
- Same-origin Next.js BFF routes and hardened admin middleware.
- Enabled login/logout UI and verified administrator presentation.
- Positive and negative automated tests.

Out of scope:

- Admin business mutations authorized by the web-session marker.
- Cognito MFA/new-password challenge completion.
- Replacing Cognito or PostgreSQL role ownership.

## Risk Classification

Risk flags:

- Authentication.
- Authorization.
- Credential handling.
- Session handling.
- Provider integration.
- Public API boundary.

Hard gates:

- No provider token or password persistence/logging.
- Cognito access-token verification before local mapping.
- Current PostgreSQL administrator role on every session validation.
- Redis, database, and provider failures fail closed.
- Negative-path proof before completion.

## Work Phases

1. Add story and decision records.
2. Add Cognito login adapter behavior and tests.
3. Add Redis session store and administrator auth service with tests.
4. Add internal Express BFF endpoints and abuse controls.
5. Add Next.js BFF routes and server-validated middleware.
6. Enable login/logout and verified administrator UI.
7. Run focused and full validators, browser smoke, and security self-review.
8. Update Harness records, commit, and push the PR branch.

## Stop Conditions

Pause for human confirmation if:

- Cognito must be replaced.
- A database migration becomes necessary.
- Provider tokens must be exposed to browser JavaScript.
- Validation requirements must be weakened.
