# Test Matrix

This file maps TrustBite product behavior to proof. The durable source used by agents is also the Harness CLI:

```bash
npm run harness -- query matrix
```

Do not mark a row `implemented` until code exists and validation evidence is recorded.

## Status Values

| Status | Meaning |
| --- | --- |
| planned | Accepted as intended behavior, not implemented |
| in_progress | Actively being built |
| implemented | Implemented and proof exists |
| changed | Contract changed after earlier implementation |
| retired | No longer part of the product contract |

## Matrix

| Story | Contract | Unit | Integration | E2E | Platform | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TB-HARNESS-001 | Repository has Harness operating docs, templates, durable CLI database, portable npm wrapper, and project-specific agent rules | no | yes | no | yes | implemented | `npm run harness -- query matrix`; `npm run harness -- story verify TB-HARNESS-001` |
| TB-APP-001 | TrustBite app can be installed and both client/server development processes are documented | no | no | no | planned | planned | `README.md`; needs smoke validation on target machine |
| TB-UI-001 | Home page shows restaurant search/list/detail and anti-fraud simulation for receipt/GPS workflow | no | no | planned | no | planned | `client/src/app/page.js`; needs client build and manual/E2E proof |
| TB-API-001 | Express server exposes health and API namespace with mounted auth/restaurant/review/aws routes | no | planned | no | no | planned | `server/src/app.js`, `server/src/routes/`; route mounting incomplete |
| TB-AUTH-001 | Users authenticate through Cognito and protected review actions require valid identity | planned | planned | planned | no | planned | high-risk; no proof yet |
| TB-REVIEW-001 | Users can create verified food reviews tied to restaurant, receipt, and verification state | planned | planned | planned | no | planned | high-risk; no proof yet |
| TB-FRAUD-001 | Receipt OCR verification rejects duplicates, validates merchant/timestamp, and stores evidence | planned | planned | planned | no | planned | high-risk; no proof yet |
| TB-FRAUD-002 | GPS/Haversine verification validates user proximity to restaurant using explicit threshold | planned | planned | planned | no | planned | UI simulation exists; backend proof missing |
| TB-TRUST-001 | Trust score is computed by backend rules from verified reviews and fraud signals | planned | planned | planned | no | planned | high-risk; no proof yet |
| TB-AWS-001 | AWS integrations work locally through LocalStack where supported and are isolated behind services | no | planned | no | planned | planned | high-risk; no proof yet |

## Evidence Rules

- Unit proof covers pure rules: Haversine distance, merchant similarity, timestamp limits, duplicate hash policy, trust-score math.
- Integration proof covers Express routes, PostgreSQL persistence, LocalStack/AWS service behavior, auth middleware, and API contracts.
- E2E proof covers user-visible browser flows: search, select restaurant, upload receipt, review submission, auth-gated actions.
- Platform proof covers Docker/LocalStack/Postgres startup, environment setup, and runtime behavior that cannot be proven in lower layers.
- A story can be implemented without every proof column only when the story packet explains why.

## Required Proof By Work Type

| Work type | Minimum proof before completion |
| --- | --- |
| Docs-only harness changes | docs review + `npm run harness -- query ...` command where relevant |
| Client UI only | `npm run client:build` or documented failure; manual screenshot/E2E when behavior matters |
| Server route/service | server start/smoke plus integration or unit proof; add missing test script when practical |
| Database/schema | migration up/down or reset proof; data integrity check |
| Auth/security/provider | high-risk story, integration proof, negative-path proof, and durable decision if contract changes |
