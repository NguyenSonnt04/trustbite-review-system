# Agent Instructions

## Project

TrustBite is a reliable food review platform. The product goal is to restore trust in food reviews by combining review UX with anti-fraud verification:

- receipt/OCR validation with AWS Textract and S3,
- restaurant proximity validation with GPS/Haversine distance,
- review summarization with AWS Bedrock/Claude,
- authentication and messaging through AWS Cognito/SES,
- PostgreSQL as the application database,
- LocalStack for local AWS simulation.

Current implementation is a JavaScript monorepo:

- `client/`: Next.js App Router, React, vanilla CSS modules.
- `server/`: Node.js + Express using native ES modules.
- `docker-compose.yml`: PostgreSQL, LocalStack, and pgAdmin.

## Required Start Of Work

Before changing code or product docs:

1. Read `README.md`.
2. Read `docs/FEATURE_INTAKE.md` and choose the lane: `tiny`, `normal`, or `high-risk`.
3. Run `npm run harness -- query matrix` when the local Harness CLI exists.
4. For normal/high-risk work, read `docs/ARCHITECTURE.md`, `docs/CONTEXT_RULES.md`, and relevant `docs/product/*` / `docs/stories/*`.
5. For auth, authorization, data model, audit/security, AWS provider behavior, or public API changes, treat the task as high-risk unless the human explicitly narrows scope.

## Project-Specific Engineering Rules

- Do not hardcode secrets, credentials, tokens, bucket names, user IDs, or database passwords in source files. Use `.env`, `.env.local`, or documented examples only.
- Keep AWS integrations behind `server/src/services/` or `server/src/config/`; controllers/routes should not instantiate provider clients directly.
- Parse and validate unknown input at HTTP/API boundaries before passing it to services or domain logic.
- Keep anti-fraud rules explicit and testable: OCR match threshold, receipt age limit, duplicate hash policy, GPS distance threshold, and trust-score effects must be documented before implementation.
- Keep client UI state separate from server trust decisions. The client may simulate flows, but final verification/trust outcomes must come from backend rules once implemented.
- Prefer small vertical slices: route + service/domain rule + validation evidence + UI only when the story needs it.
- If behavior changes, update `docs/product/*`, `docs/stories/*`, and the Harness matrix/CLI records in the same change.

## Validation Commands

Use the smallest relevant set:

```bash
npm run client:build
npm run server:build # currently unavailable unless added by a story
npm run dev          # manual smoke for both apps
npm run docker:up    # infrastructure smoke
```

Current package scripts have no automated server test/lint/build command. If a story depends on backend proof, add or document the missing validation path instead of claiming proof that does not exist.

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
