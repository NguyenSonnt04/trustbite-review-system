# Validation

## Proof Strategy

This story remains in progress until automated proof covers Cognito JWT middleware, local user mapping, and negative-path tests. Current source-of-truth documents consistently state Cognito-first auth, and the implementation includes partial middleware/provider/local mapping behavior.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Pending automated proof: JWT claim parser, JWKS/cache behavior, issuer/client-id/token-use validation, local account-status rule. |
| Integration | Pending automated proof: protected Express route accepts valid Cognito access JWT and rejects missing, expired, invalid signature, wrong issuer, wrong client id, wrong token use, unmapped identity, suspended/deleted account. |
| E2E | Future: client/mobile obtains Cognito token and calls protected review/profile API. |
| Platform | Future: LocalStack Cognito or explicit Cognito-compatible test double; production config uses real Cognito provider values from env. |
| Performance | Future: JWKS cache does not fetch on every request and concurrent stale-cache requests share one in-flight JWKS refresh. |
| Logs/Audit | Future: no raw token, refresh token, OTP code, or full sensitive identity values in logs; account-state decisions auditable where required. |

## Fixtures

Required automated fixtures:

- Cognito-compatible JWKS and tokens for valid/invalid cases.
- Active user mapped to Cognito `sub` through `users.cognito_sub`.
- Suspended user mapped to Cognito `sub` through `users.cognito_sub`.
- Deleted user mapped to Cognito `sub` through `users.cognito_sub`.
- Unmapped Cognito `sub`.
- Phone-number fallback only when the provider phone claim is verified and the local row has no `users.cognito_sub`.

## Commands

Docs alignment commands:

```text
npm run harness -- query matrix
npm run harness -- query decisions
```

Implementation commands must include backend route/service proof once test scripts exist.

## Acceptance Evidence

Current implementation evidence remains partial until automated Cognito JWT positive/negative tests are added. Local proof should include syntax/build checks, migration proof for `users.cognito_sub`, and route smoke checks where a trusted local identity is explicitly enabled outside production.
