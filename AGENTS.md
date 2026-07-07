# Agent Instructions

## Project

TrustBite is a reliable food review platform. The product goal is to restore trust in food reviews by combining review UX with anti-fraud verification:

- receipt/OCR validation with AWS Textract and S3,
- restaurant proximity validation with GPS/Haversine distance,
- review summarization with AWS Bedrock/Claude,
- authentication and messaging through AWS Cognito/SES,
- PostgreSQL as the application database,
- LocalStack for local AWS simulation.

Current implementation is a JavaScript monorepo plus a Flutter mobile app:

- `client/`: Next.js App Router, React, vanilla CSS modules.
- `server/`: Node.js + Express using native ES modules.
- `mobile/`: Flutter/Dart mobile app and tests.
- `docker-compose.yml`: PostgreSQL, Redis, LocalStack, and pgAdmin.

## Required Start Of Work

Before changing code or product docs:

1. Read `README.md`.
2. Read `docs/FEATURE_INTAKE.md` and choose the lane: `tiny`, `normal`, or `high-risk`.
3. Run `npm run harness -- query matrix` when the local Harness CLI exists.
4. For normal/high-risk work, read `docs/ARCHITECTURE.md`, `docs/CONTEXT_RULES.md`, and relevant `docs/product/*` / `docs/stories/*`.
5. For auth, authorization, data model, audit/security, AWS provider behavior, or public API changes, treat the task as high-risk unless the human explicitly narrows scope.
6. Before coding, read the relevant product doc, story packet, architecture rules, and existing code/model files for the affected domain. Do not implement from memory when docs or schema exist.

## Project-Specific Engineering Rules

- Do not hardcode secrets, credentials, tokens, bucket names, user IDs, or database passwords in source files. Use `.env`, `.env.local`, or documented examples only.
- Keep AWS integrations behind `server/src/services/` or `server/src/config/`; controllers/routes should not instantiate provider clients directly.
- Use Cognito as the authentication and token-issuance source of truth from day one. Do not build a generic/backend-issued auth, JWT, refresh-token, or session layer first and attach Cognito later.
- Keep business APIs in the Express backend. Protected routes must verify Cognito JWTs in Express auth middleware or a deployment authorizer boundary, then enforce TrustBite-local user status and business authorization before services run.
- Parse and validate unknown input at HTTP/API boundaries before passing it to services or domain logic.
- For database-backed work, treat `server/migrations/` as the schema source of truth. Server models, services, SQL, DTO mapping, and validation must match existing table/column names, constraints, enum/check values, nullability, generated columns, and relationships.
- Do not add, assume, or write fields outside the accepted schema. New tables/columns/indexes/constraints require a high-risk story, migration, rollback/reset proof, and updated product/story docs before implementation is claimed complete.
- For DB-affecting work, run `npm run db:migrate` against the local PostgreSQL environment, then prove inserts/updates occur inside transactions and can be rolled back without residue. Document any missing local DB/env blocker instead of claiming proof.
- Keep anti-fraud rules explicit and testable: OCR match threshold, receipt age limit, duplicate hash policy, GPS distance threshold, and trust-score effects must be documented before implementation.
- Keep client UI state separate from server trust decisions. The client may simulate flows, but final verification/trust outcomes must come from backend rules once implemented.
- Prefer small vertical slices: route + service/domain rule + validation evidence + UI only when the story needs it.
- Treat tests as executable product contracts, not confirmations of whatever the current implementation happens to do.
- For normal and high-risk implementation work, follow TDD where practical: write or update the failing test/contract proof from the product doc, story acceptance criteria, schema, and boundary rules before changing production code; then make the smallest implementation change; then refactor with tests still passing.
- Do not write post-hoc tests that merely mirror implementation details to increase coverage. Avoid testing private internals, brittle snapshots, excessive mocks, happy-path-only assertions, rewritten-code assertions, and tests whose expected values come from the function under test.
- Negative paths and abuse cases are required when the story touches auth, authorization, validation, anti-fraud rules, providers, public APIs, or persistence.
- If the repo lacks the needed test runner or local dependency for a story, add the smallest appropriate test harness when practical; otherwise document the blocker and do not claim automated proof.
- If behavior, schema, API contract, validation expectation, or provider boundary changes, update `docs/product/*`, `docs/stories/*`, decisions when needed, and the Harness matrix/CLI records in the same change.

## Commit And PR Naming

- Use Conventional Commits for commit subjects: `type(scope): imperative summary`.
- Keep commit subjects lowercase after the prefix, except proper nouns, product names, and acronyms.
- Use concise product or engineering language in PR titles, like a company-owned change, not an agent artifact.
- Do not prefix commit subjects, branch names, or PR titles with `codex`, `[codex]`, agent names, or Harness story IDs.
- Put Harness story IDs, validation proof, and AI/tool attribution in the PR body or trace when useful, not in the title.
- Prefer PR titles such as `Process account deletions` or `Add mobile runtime configuration` over `TB-...` titles.

## Validation Commands

Use the smallest relevant set:

```bash
npm run client:build
npm run server:build  # syntax check, not a test suite
npm run mobile:test   # Flutter widget tests
npm run dev           # manual smoke for client and server
npm run docker:up     # infrastructure smoke
npm run db:migrate    # local PostgreSQL schema proof for DB-affecting work
```

Current package scripts still have no automated server test/lint command; `npm run server:build` exists as a syntax check, not a test suite. If a story depends on backend proof, add or document the missing validation path instead of claiming proof that does not exist. DB stories also need local insert/update plus rollback evidence against migrated PostgreSQL, or an explicit blocker if local infrastructure is unavailable.

<!-- HARNESS:BEGIN -->
## Harness

This repo uses Harness. Before work, read:

- `README.md`
- `docs/HARNESS.md`
- `docs/FEATURE_INTAKE.md`
- `docs/ARCHITECTURE.md`
- `docs/CONTEXT_RULES.md`
- `npm run harness -- query matrix`

Use `npm run harness -- <command>` as the portable Harness command. It delegates to the Rust Harness CLI in `scripts/bin/`.
<!-- HARNESS:END -->
