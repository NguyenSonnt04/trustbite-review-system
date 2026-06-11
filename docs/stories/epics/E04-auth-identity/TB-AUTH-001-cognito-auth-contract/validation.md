# Validation

## Proof Strategy

This docs alignment slice is complete when Harness/source-of-truth documents consistently state Cognito-first auth and the durable matrix no longer describes Cognito as deferred. Implementation remains unproven until a later story adds Cognito JWT middleware, local user mapping, and negative-path tests.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Future: JWT claim parser, JWKS/cache behavior, issuer/audience/token-use validation, local account-status rule. |
| Integration | Future: protected Express route accepts valid Cognito JWT and rejects missing, expired, invalid signature, wrong issuer, wrong audience, wrong token use, unmapped identity, suspended/deleted account. |
| E2E | Future: client/mobile obtains Cognito token and calls protected review/profile API. |
| Platform | Future: LocalStack Cognito or explicit Cognito-compatible test double; production config uses real Cognito provider values from env. |
| Performance | Future: JWKS cache does not fetch on every request. |
| Logs/Audit | Future: no raw token, refresh token, OTP code, or full sensitive identity values in logs; account-state decisions auditable where required. |

## Fixtures

Future implementation fixtures:

- Cognito-compatible JWKS and tokens for valid/invalid cases.
- Active user mapped to Cognito `sub`.
- Suspended user mapped to Cognito `sub`.
- Deleted user mapped to Cognito `sub`.
- Unmapped Cognito `sub`.

## Commands

Docs alignment commands:

```text
npm run harness -- query matrix
npm run harness -- query decisions
```

Future implementation commands must include backend route/service proof once test scripts exist.

## Acceptance Evidence

TBD after validation commands run for this docs alignment. Implementation evidence remains pending.
