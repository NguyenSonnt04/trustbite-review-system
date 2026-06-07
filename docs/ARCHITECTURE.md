# Architecture

TrustBite is a JavaScript monorepo with a Next.js client, an Express backend, PostgreSQL, and AWS integrations. This document is the architecture contract for humans and agents before implementation work.

## Current Stack

| Area | Current choice | Location |
| --- | --- | --- |
| Web client | Next.js App Router, React, JS/JSX, CSS modules | `client/` |
| API server | Node.js + Express, native ES modules | `server/` |
| Database | PostgreSQL via `pg` pool | `server/src/config/db.js`, `docker-compose.yml` |
| Local cloud simulation | LocalStack | `docker-compose.yml` |
| AWS integrations | S3, Textract, Cognito, SES, Bedrock/Claude planned/configured | `server/src/config/aws.js`, `server/src/services/` |
| Runtime config | `.env`, `.env.local` | documented in `README.md` |

## Repository Boundaries

```text
client/
  src/app/          # user-visible routes, page layout, CSS
  src/components/   # reusable UI widgets when extracted
  src/config/       # browser-safe configuration only
  src/hooks/        # browser/client helpers
  src/services/     # API clients, no server secrets

server/
  src/app.js        # Express app construction and middleware
  src/server.js     # process entrypoint and lifecycle
  src/config/       # env, database, AWS provider configuration
  src/routes/       # route declarations
  src/controllers/  # request/response orchestration
  src/services/     # business logic, provider integration, persistence coordination
  src/models/       # entity/data shape definitions until schema/migrations exist
  src/middlewares/  # auth, errors, request middleware
```

## Product Domains

Treat these names as stable product concepts unless a decision record changes them:

- **User**: person authenticating and creating/reading reviews.
- **Restaurant**: food venue being searched, reviewed, and verified.
- **Review**: user-submitted opinion plus trust/verification metadata.
- **Receipt / Invoice**: uploaded proof used for OCR and duplicate detection.
- **Verification**: anti-fraud outcome from OCR, timestamp, merchant match, duplicate hash, and GPS checks.
- **Trust Score**: aggregate confidence indicator; must be computed by backend rules once real implementation exists.
- **Price History**: menu/price observations that can flag outdated or suspicious prices.
- **Badge**: user or restaurant trust marker derived from behavior/rules.

## Dependency Rule

Keep dependencies flowing inward:

```text
client UI -> API client -> server routes/controllers -> services/domain rules -> database/provider adapters
```

Rules:

- `client/` must not import from `server/`.
- Browser code must never read server secrets or provider credentials.
- Controllers should parse input and call services; they should not contain provider-specific logic.
- Services may use database/provider clients, but anti-fraud and trust-score rules should stay explicit and testable.
- Configuration modules may read `process.env`; domain/rule functions should receive values as parameters or typed config.

## Boundary Inputs To Parse First

Unknown data must be parsed/validated at boundaries before business logic uses it:

- HTTP params, query strings, bodies, multipart uploads.
- Cognito/JWT claims and authorization context.
- Environment variables.
- Database rows and provider responses.
- S3/Textract/Bedrock/SES/Cognito payloads.
- GPS coordinates from the browser.
- Receipt metadata and OCR text.

## Anti-Fraud Verification Contract

Any real verification implementation must document and test these rules before claiming completion:

| Rule | Current/expected constraint | Proof expectation |
| --- | --- | --- |
| Duplicate receipt | Receipt/image hash must reject repeated submissions | unit + integration |
| OCR extraction | Textract/S3 flow extracts merchant, timestamp, line items when available | integration/provider-local proof |
| Merchant matching | Similarity threshold must be explicit; current UI simulation uses 80% | unit |
| Receipt age | Receipt timestamp limit must be explicit; current UI simulation uses 48h | unit |
| GPS proximity | Distance threshold must be explicit; current UI simulation uses 200m | unit + integration |
| Trust score mutation | Verification outcome must affect review/trust state through backend rules, not client-only state | integration + E2E when UI exists |

## API Shape Rules

Until OpenAPI or typed contracts exist, keep API changes documented in the relevant story packet:

- Route path and method.
- Request body/query/params.
- Success response shape.
- Error response shape.
- Auth/authorization requirement.
- Validation proof.

Public API changes are at least `normal` lane. Auth, authorization, security, data model, and AWS provider behavior are `high-risk` unless explicitly narrowed.

## Data And Migration Rules

- PostgreSQL is the application store. Do not use Harness SQLite (`harness.db`) for product data.
- Schema-changing work requires a story packet and a durable decision if it changes ownership, retention, uniqueness, or deletion semantics.
- Data loss, migration, or rollback behavior is high-risk.
- Keep audit/security records distinct from operational logs.

## Observability Contract

Future server work should move toward one canonical JSON log line per request:

- timestamp,
- level,
- request_id,
- user_id when known,
- action/route,
- duration_ms,
- status_code,
- message.

Audit logs are product records. Application logs are operational records. Do not substitute one for the other.

## Current Gaps

These are not implemented yet and should not be claimed as complete without a story and proof:

- server route mounting beyond health/basic skeleton,
- real OCR/Textract processing,
- real Cognito authentication enforcement,
- review persistence and schema migrations,
- trust-score computation,
- automated backend tests,
- formal API contract/OpenAPI,
- CI pipeline.
