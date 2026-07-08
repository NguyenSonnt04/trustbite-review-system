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
| TB-REST-001 | Restaurant CRUD API persists restaurants, keeps geo/category data consistent, and soft-deletes safely | yes | yes | no | yes | implemented | 2026-07-08 Phase 3 backend CRUD closeout: db:migrate applied 0; unit proof passed 13 files / 115 tests; restaurant CRUD integration proof passed 6 files / 49 tests with 1 skipped file / 2 skipped tests; server:build passed 91 files; story verify passed; decision 0016 records the mutation-boundary policy. |
| TB-REST-002 | Public restaurant list supports keyword, radius, trust-score filter, sort, and nearby map-bounds lookup | yes | yes | no | yes | implemented | 2026-07-08 Phase 3 search/filter/nearby closeout: db:migrate applied 0; unit proof passed 13 files / 115 tests; restaurant search integration proof passed 7 files / 63 tests with 1 skipped file / 2 skipped tests; server:build passed 91 files; story verify passed. |
| REST-US-003 | Public restaurant detail returns active profile, rating breakdown, latest claim status, and verified/reference public reviews | yes | yes | no | yes | implemented | 2026-07-08 Phase 3 detail/reviews closeout: db:migrate applied 0; unit proof passed 13 files / 115 tests; restaurant detail integration proof passed 8 files / 67 tests with 1 skipped file / 2 skipped tests; server:build passed 91 files; story verify passed. |
| TB-APP-001 | TrustBite app can be installed and both client/server development processes are documented | no | no | no | planned | planned | `README.md`; needs smoke validation on target machine |
| TB-UI-001 | Home page shows restaurant search/list/detail and anti-fraud simulation for receipt/GPS workflow | no | no | planned | no | planned | `client/src/app/page.js`; needs client build and manual/E2E proof |
| TB-API-001 | Express server exposes health and API namespace with mounted auth/restaurant/review/aws routes | no | planned | no | no | planned | `server/src/app.js`, `server/src/routes/`; route mounting incomplete |
| TB-AUTH-001 | Cognito-first authentication contract; Express business APIs verify Cognito JWTs and enforce local account state | planned | planned | planned | no | planned | high-risk; no proof yet |
| TB-REVIEW-001 | Users can create verified food reviews tied to restaurant, receipt, and verification state | yes | yes | no | no | implemented | 2026-07-08 Phase 4 backend Review & OCR closeout plus PR #38 review follow-up: PR #36/TB-FRAUD-001 dependency verified merged into `main`; queue enqueue failures now persist a fixed public manual-review reason instead of raw queue/provider error messages exposed by owner-scoped status metadata; db:migrate applied 0; full server test passed 31 files / 1 skipped and 308 tests / 2 skipped; server:build passed 102 files; story verify passed. Covers 4.1 review create API, 4.2 receipt upload/private S3/idempotency/duplicate hash proof, 4.3 upload-to-OCR enqueue including durable `PENDING_ADMIN_REVIEW` degradation when post-commit enqueue fails, 4.4 receipt verification lifecycle proof through PR #36, and 4.5 owner-scoped review status API. UI/mobile/admin UI excluded. |
| TB-FRAUD-001 | Receipt OCR verification rejects duplicates, validates merchant/timestamp, and stores evidence | yes | yes | no | no | implemented | 2026-07-08 PR #36 merged into `main`; Harness marks implemented with OCR provider/unit/integration proof and full story verify evidence. Live AWS Textract E2E is not claimed. |
| TB-FRAUD-002 | GPS/Haversine verification validates user proximity to restaurant using explicit threshold | yes | no | no | no | implemented | Backend GPS/Haversine unit proof exists with explicit configurable threshold; UI simulation is not the source of truth. |
| TB-TRUST-001 | Trust score is computed by backend rules from verified reviews and fraud signals | yes | yes | no | no | implemented | Backend trust-score recomputation proof exists in Harness matrix; UI/mobile presentation remains outside this row. |
| TB-AWS-001 | AWS integrations work locally through LocalStack where supported and are isolated behind services | no | planned | no | planned | planned | high-risk; no proof yet |
| TB-MOBILE-001 | Flutter mobile app has documented backend integration contracts before implementing OCR, GPS, reviews, and trust score flows | no | planned | planned | planned | planned | `docs/stories/epics/E03-mobile/US-001-mobile-api-integration-contract.md`; no implementation proof yet |
| TB-DATA-002 | Baseline PostgreSQL migration creates the documented TrustBite schema locally | no | yes | no | yes | implemented | `npm run docker:up`; `npm run db:migrate`; verified 54 application tables plus `schema_migrations` |

## Evidence Rules

- Unit proof covers pure rules: Haversine distance, merchant similarity, timestamp limits, duplicate hash policy, trust-score math.
- Integration proof covers Express routes, PostgreSQL persistence, LocalStack/AWS service behavior, auth middleware, and API contracts.
- Database integration proof must include `npm run db:migrate` against local PostgreSQL plus insert/update rollback or reset evidence for the affected tables.
- E2E proof covers user-visible browser flows: search, select restaurant, upload receipt, review submission, auth-gated actions.
- Platform proof covers Docker/LocalStack/Postgres startup, environment setup, and runtime behavior that cannot be proven in lower layers.
- A story can be implemented without every proof column only when the story packet explains why.

## Required Proof By Work Type

| Work type | Minimum proof before completion |
| --- | --- |
| Docs-only harness changes | docs review + `npm run harness -- query ...` command where relevant |
| Client UI only | `npm run client:build` or documented failure; manual screenshot/E2E when behavior matters |
| Server route/service | server start/smoke plus integration or unit proof; add missing test script when practical |
| Database/schema | read `server/migrations/` and affected models; `npm run db:migrate`; local insert/update transaction proof; rollback/reset proof; data integrity check |
| Auth/security/provider | high-risk story, integration proof, negative-path proof, and durable decision if contract changes |
