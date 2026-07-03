# Validation

## Proof Strategy

Automated proof must cover the Cognito JWT provider, protected Express middleware,
local user mapping, account-state enforcement, and negative paths without adding a
backend-issued token/session path.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Signed RS256 token acceptance; malformed claims; issuer/client-id/token-use/time validation; invalid signature/algorithm; JWKS key metadata and malformed entries; provider failures; key rotation; concurrent JWKS fetch sharing; unknown-`kid` refresh cooldown. |
| Integration | Protected profile route accepts a signed Cognito access JWT and rejects missing/malformed tokens, unmapped identities, and suspended/deleted local accounts. |
| E2E | Future client/mobile story: obtain a Cognito token from the configured provider and call a protected API. |
| Platform | Cognito-compatible RSA/JWKS test double preserves Cognito claim semantics; production pool provisioning remains outside this story. |
| Performance | Concurrent token verification shares one in-flight JWKS request; a rotated `kid` triggers one refresh; repeated unknown key ids cannot force sequential JWKS refreshes during the cooldown window. |
| Logs/Audit | Auth errors use structured HTTP errors and do not add raw-token logging. Additional production log capture remains release hardening. |

## Fixtures

Required automated fixtures:

- Cognito-compatible JWKS and tokens for valid/invalid cases.
- Active user mapped to Cognito `sub` through `users.cognito_sub`.
- Suspended user mapped to Cognito `sub` through `users.cognito_sub`.
- Deleted user mapped to Cognito `sub` through `users.cognito_sub`.
- Unmapped Cognito `sub`.
- Phone-number fallback only when the provider phone claim is verified and the local row has no `users.cognito_sub`.

## Commands

Validation commands:

```text
npm run test --prefix server -- tests/unit/auth/cognitoProvider.test.js tests/unit/auth/authService.test.js
npm run test --prefix server -- tests/integration/userProfile.integration.test.js
npm run server:test
npm run server:build
npm run db:migrate
npm run harness -- query matrix
git diff --check
```

## Acceptance Evidence

Validated on 2026-07-03:

- Provider/auth unit proof passed: 2 files, 26 tests.
- Profile route integration proof passed: 1 file, 12 tests, including a signed
  RSA Cognito JWT resolved through JWKS and mapped by `users.cognito_sub`.
- Full server suite passed: 10 files, 86 tests.
- Server syntax build passed: 80 files.
- PostgreSQL migration proof passed with 0 pending migrations.
- Negative proof covers missing/malformed tokens, signature and claim failures,
  provider/JWKS failures, unmapped identity, and suspended/deleted accounts.
- TDD exposed and fixed two fail-open gaps: non-numeric `nbf` claims and matching
  JWKs whose type, algorithm, or use is not valid for RS256 signing.
- Review follow-up added a shared 30-second cooldown after an unknown-`kid`
  refresh, so sequential attacker-controlled key ids do not trigger unbounded
  provider requests while legitimate rotation still gets one immediate refresh.
- JWKS responses now reject a null document and malformed key entries before
  caching, preserving the structured `503 PROVIDER_UNAVAILABLE` boundary instead
  of leaking a runtime `TypeError` as `500 INTERNAL_ERROR`.
