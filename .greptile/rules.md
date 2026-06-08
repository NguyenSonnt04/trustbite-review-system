# TrustBite Review Rules

## Project context

TrustBite is a food review platform focused on trusted reviews and anti-fraud verification.

Current architecture:

- `client/`: Next.js App Router, React, JavaScript/JSX, CSS modules.
- `server/`: Node.js + Express, native ES modules.
- `mobile/`: Flutter/Dart mobile application.
- PostgreSQL is the application database.
- AWS integrations are S3, Textract, Cognito, SES, and Bedrock/Claude, with LocalStack for local simulation.
- `docs/` contains Harness docs and is the source of truth for work intake, risk classification, validation, and traceability.
- `trustbite-docs/` contains imported TrustBite product, UX, API, security, database, QA, compliance, and operations documentation.

## Review priorities

Prioritize comments about:

1. Security and secret handling.
2. Auth/authz correctness.
3. API boundary validation.
4. AWS provider isolation.
5. Data model and persistence risk.
6. Anti-fraud rules being explicit and testable.
7. Client/server boundary violations.
8. Missing validation path for backend behavior.
9. Behavior changes without matching Harness story docs and TrustBite product docs where applicable.

Avoid low-value comments about subjective style unless the style issue affects maintainability, accessibility, correctness, or consistency.

## Required project rules

- Do not hardcode secrets, credentials, tokens, bucket names, user IDs, or database passwords in source files.
- Keep AWS integrations behind `server/src/services/` or `server/src/config/`.
- Controllers/routes should not instantiate provider clients directly.
- Parse and validate unknown input at HTTP/API boundaries.
- Keep anti-fraud rules explicit and testable:
  - OCR match threshold.
  - Receipt age limit.
  - Duplicate hash policy.
  - GPS distance threshold.
  - Trust-score effects.
- Keep client UI state separate from server trust decisions.
- The client may simulate flows, but final verification/trust outcomes must come from backend rules once implemented.
- Public API changes require route/method/request/response/error/auth/validation documentation.
- Auth, authorization, audit/security, data model, AWS provider behavior, and public API changes are high-risk unless explicitly narrowed.

## Validation expectations

Available commands:

```bash
npm run client:build
npm run dev
npm run docker:up
npm run harness -- query matrix
```

There is currently no automated server build/test/lint command. Do not accept claims that backend behavior is proven unless a real validation path is added or documented.
