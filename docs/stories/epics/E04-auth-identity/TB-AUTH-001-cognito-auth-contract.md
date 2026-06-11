# TB-AUTH-001 Cognito-First Authentication Contract

## Status

in_progress

## Lane

high-risk

## Product Contract

Cognito owns TrustBite authentication and token issuance from day one. TrustBite must not implement a generic backend-issued auth, JWT, refresh-token, or session layer first and attach Cognito later.

Business APIs remain in the Express backend. Protected Express routes verify Cognito JWTs in auth middleware or a deployment authorizer boundary, then enforce local TrustBite user mapping, account status, roles, and business authorization before services run.

## Relevant Product Docs

- `docs/product/authentication.md`
- `docs/product/provider-integrations.md`
- `docs/ARCHITECTURE.md`
- `docs/decisions/0010-cognito-first-auth-boundary.md`
- Folder packet: `docs/stories/epics/E04-auth-identity/TB-AUTH-001-cognito-auth-contract/`

## Acceptance Criteria

- Cognito-first auth is recorded as the durable decision and product contract.
- Backend-issued JWT/refresh/session stories are retired or superseded.
- Auth implementation guidance says Express business APIs stay normal backend services.
- Protected-route guidance says Cognito JWT verification belongs in auth middleware/authorizer boundaries.
- Validation expectations include positive and negative Cognito JWT checks, local account-state rejection, and no raw token logging before auth can be marked implemented.

## Design Notes

- Commands: Cognito login/signup/token flows are provider-owned; Express protected routes receive bearer JWTs.
- Queries: local user lookup by Cognito subject via `users.cognito_sub`, with phone-number fallback only for verified-phone legacy/local rows that do not yet have a Cognito subject during transition.
- API: protected routes require `Authorization: Bearer <Cognito access token>` unless explicitly documented otherwise.
- Tables: `users.cognito_sub` stores the stable Cognito subject and is unique when present.
- Domain rules: `SUSPENDED` and `DELETED` local users are rejected even with valid Cognito tokens.
- UI surfaces: future web/mobile auth screens must target Cognito token semantics.

## Validation

When updating durable proof status, use numeric booleans:
`npm run harness -- story update --id TB-AUTH-001 --unit 0 --integration 0 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Future Cognito claim parser/JWKS validation/local account-state rules |
| Integration | Future Express middleware accepts valid Cognito access JWT and rejects missing/invalid/expired/wrong issuer/wrong client id/wrong token use/unmapped/suspended/deleted users |
| E2E | Future client/mobile obtains Cognito token and calls protected API |
| Platform | Future LocalStack Cognito or explicit Cognito-compatible test double proof; production config from env |
| Release | `npm run harness -- query matrix`; `npm run harness -- query decisions`; doc review |

## Harness Delta

- Added decision `0010-cognito-first-auth-boundary`.
- Added product docs for authentication and provider integrations.
- Retired old backend-owned OTP/session durable rows.
- Updated AGENTS/architecture guidance to say Cognito-first plus Express business APIs.

## Evidence

Docs alignment proof:

```bash
npm run harness -- import brownfield
npm run harness -- query matrix
npm run harness -- query decisions
```

Implementation proof: in progress; Cognito middleware/provider adapter and `users.cognito_sub` migration exist, but full Cognito positive/negative automated tests are still pending.
