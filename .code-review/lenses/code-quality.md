# Code Quality

Evaluate whether the diff is correct, safe, and idiomatic for TrustBite's JavaScript monorepo and Flutter app.

## Criteria
- Boundary validation: Express routes/controllers must parse and validate unknown params, query strings, bodies, multipart metadata, Cognito/JWT claims, environment values, database rows, and provider responses before service/domain logic uses them.
- Auth and authorization: protected backend behavior must rely on Cognito JWT verification plus TrustBite-local user/account status and product roles; flag backend-issued generic auth/session/JWT layers, role grants from Cognito groups alone, or client-side trust decisions.
- Provider boundaries: AWS, LocalStack, PostgreSQL, Cognito, SES, S3, Textract, and Bedrock/Claude integrations must stay behind `server/src/services/` or `server/src/config/`; controllers/routes must not instantiate provider clients directly.
- Schema fidelity: database code must match `server/migrations/` table names, columns, constraints, enum/check values, nullability, generated columns, defaults, and relationships; flag assumed fields, silent schema extensions, and non-transactional write sequences.
- Anti-fraud correctness: OCR thresholds, receipt age limits, duplicate-hash policy, GPS/Haversine distance thresholds, and trust-score effects must be explicit, backend-enforced, and testable rather than simulated in client UI state.
- API behavior: public API changes must document route/method, request shape, response/error shape, auth requirements, and validation proof in the relevant story or product docs.
- Frontend correctness: Next.js App Router client code must keep browser-safe config in `client/src/config`, avoid server secrets, keep API access in `client/src/services`, and handle loading/error/empty states without trusting client-only verification outcomes.
- Mobile correctness: Flutter changes must preserve documented backend contracts and avoid hardcoded API endpoints, secrets, or verification conclusions that should come from the server.
- Tests as contracts: new or changed behavior should have focused positive and negative tests where practical; flag tests that only mirror implementation details, assert values computed by the function under test, or cover only happy paths for auth, validation, anti-fraud, providers, or persistence.
- Secrets and config: flag hardcoded credentials, tokens, bucket names, passwords, user IDs, production endpoints, or environment-specific values in source files.

## Tools
- `npm run lint --prefix client`
- `npm run server:test:unit`
- `npm run mobile:test`

## Severity
- blocker: A change can bypass auth/authorization, weaken validation, corrupt or mis-map persisted data, leak secrets, instantiate providers in routes/controllers, or allow client-controlled trust/verification outcomes.
- warning: A change is likely correct but lacks negative-path proof, has brittle tests, mixes orchestration with domain/provider details, or omits required API/story documentation for a contract change.
- note: A small readability, naming, error-message, or organization issue that does not change behavior or proof quality.
