# Admin Route Auth Gate Exec Plan

## Goal

Close the anonymous `/admin` access path while keeping unsupported login/admin operations explicitly locked.

## Scope

In scope:

- Add a Next.js middleware gate for `/admin` and nested admin paths.
- Remove public read-only admin bypass links.
- Keep the login form disabled until a safe Cognito web login flow exists.
- Ensure the client never writes bearer tokens into cookies.
- Add a protected admin session endpoint that verifies bearer token auth and admin role.
- Validate admin action reasons at the HTTP controller boundary.

Out of scope:

- Cognito web login implementation.
- New Express admin APIs or database schema changes.
- Durable production session design beyond the existing Cognito-first contract.

## Risk Classification

Risk flags:

- Auth.
- Authorization.
- Audit/security.
- Public contracts.
- Existing behavior.
- Weak proof.

Hard gates:

- Auth.
- Authorization.
- Audit/security.

## Work Phases

1. Discovery: read auth product contract, architecture, and current admin/auth files.
2. Design: choose a minimal gate that does not create a backend-issued auth path.
3. Validation planning: run the client build and inspect the resulting diff.
4. Implementation: add middleware and tighten login/admin guards.
5. Verification: confirm build success or document blockers.
6. Harness update: story packet added; local Harness CLI missing blocks durable CLI update.

## Stop Conditions

Pause for human confirmation if:

- Full Cognito web login behavior becomes required.
- A production-grade session design needs a backend callback or cookie issuer.
- Validation requirements need to be weakened.
