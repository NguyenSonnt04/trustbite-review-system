# Exec Plan

## Goal

Define and implement client/mobile Cognito signup, login, and forgot-password integration without introducing backend-issued production auth/session flows.

## Scope

In scope:

- Cognito signup flow integration for mobile/web clients.
- Cognito login flow integration for mobile/web clients.
- Cognito forgot-password/password-recovery flow integration.
- Token handoff contract from clients to Express protected APIs.
- Client-visible auth error/state mapping for rate limits, invalid credentials, code expiry, and password recovery.

Out of scope:

- Backend-issued OTP or JWT/refresh-token APIs.
- Custom password storage in TrustBite.
- Profile update behavior; covered by `TB-USER-PROFILE-001`.
- Admin account suspension/reactivation; covered by `TB-USER-ACCOUNT-SUSPENSION-001`.

## Risk Classification

Risk flags:

- Auth.
- External systems.
- Public contracts.
- Cross-platform.
- Audit/security.

Hard gates:

- Auth.
- External provider behavior.

## Work Phases

1. Confirm Cognito app client/user pool configuration for local and target environments.
2. Define mobile/web auth flow contracts, error states, and token handoff to Express.
3. Add or update client/mobile auth service boundaries using Cognito SDK semantics.
4. Prove Express protected APIs accept valid Cognito access tokens and reject invalid/local-denied accounts.
5. Add E2E or platform smoke for signup/login/forgot-password when environment support exists.
6. Update Harness matrix/story evidence and the external Phase 2 tracking sheet.

## Stop Conditions

Pause for human confirmation if:

- The team wants TrustBite to issue production OTP, access tokens, refresh tokens, or password reset codes.
- LocalStack Cognito is unavailable and no accepted Cognito-compatible test double or AWS sandbox proof path exists.
- Client/mobile auth UX requirements conflict with Cognito token/session ownership.
