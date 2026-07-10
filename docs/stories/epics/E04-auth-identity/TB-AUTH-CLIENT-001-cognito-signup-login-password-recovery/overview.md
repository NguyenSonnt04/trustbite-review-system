# Overview

## Current Behavior

The Phase 2 spreadsheet still lists "User login join app/ forgot password" as an in-progress backend API task, but the accepted TrustBite auth boundary makes Cognito the owner of signup, login, OTP/MFA, password recovery, token issuance, and refresh/session lifecycle. Express currently owns protected business APIs and local user/account-state enforcement after Cognito token verification.

## Target Behavior

Client and mobile auth entrypoints use Cognito signup, login, and password-recovery flows. The mobile email-first screen creates a new Cognito user before confirming its email, while an existing confirmed user starts the configured custom authentication challenge. After Cognito returns provider tokens, clients call TrustBite Express protected APIs with a Cognito access token. Express verifies the token, provisions a missing local user mapping for a verified Cognito subject, and enforces local account status before product services run.

## Affected Users

- Guest users signing up or logging in.
- Existing users recovering access.
- Mobile and web clients calling protected Express APIs.

## Affected Product Docs

- `docs/product/authentication.md`
- `docs/product/provider-integrations.md`
- `docs/decisions/0010-cognito-first-auth-boundary.md`
- `docs/decisions/0011-auth-provider-adapter-boundary.md`
- `docs/stories/epics/E04-auth-identity/TB-AUTH-001-cognito-auth-contract/`

## Non-Goals

- No backend-issued OTP, access-token, refresh-token, or password-reset API.
- No custom password or OTP secret storage in TrustBite.
- No profile-field expansion beyond the `users` schema.
- No admin suspension/reactivation implementation; that remains `TB-USER-ACCOUNT-SUSPENSION-001`.
