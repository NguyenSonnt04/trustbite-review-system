# Maintainability

Evaluate whether the diff keeps TrustBite easy to change safely across the Next.js client, Express backend, PostgreSQL schema, AWS service boundaries, Harness workflow, and Flutter app.

## Criteria
- Small vertical slices: changes should stay scoped to one story-sized behavior or maintenance concern; flag broad rewrites, mixed product domains, or unrelated formatting churn.
- Dependency direction: preserve `client UI -> API client -> server routes/controllers -> services/domain rules -> database/provider adapters`; flag imports from `client/` to `server/`, browser code reading server-only config, or service logic pushed into React components.
- Layer responsibilities: controllers should orchestrate HTTP concerns and call services; services should own persistence/provider coordination; explicit domain rules should be testable without live providers where possible.
- Harness alignment: behavior, schema, API contract, validation expectation, or provider-boundary changes must update the relevant `docs/product/*`, `docs/stories/*`, decision records when needed, and Harness matrix/trace evidence.
- Migration discipline: schema or DB-affecting changes must include migrations, rollback/reset reasoning, and local proof via `npm run db:migrate` plus transaction/rollback evidence when infrastructure is available.
- Configuration hygiene: environment parsing should be centralized in config modules; avoid duplicated defaults, scattered `process.env` reads in domain logic, and config that differs silently between client, server, Docker, and LocalStack.
- Error handling and observability: backend changes should preserve consistent Express error flow, avoid swallowing provider/database failures, redact sensitive data, and keep audit records separate from operational logs.
- Test maintainability: prefer focused unit/integration tests at service and route boundaries; avoid watch-mode assumptions, sleeps/timeouts, brittle snapshots, excessive mocks, and tests that require ports or long-running services.
- Frontend maintainability: keep reusable UI in `client/src/components`, hooks in `client/src/hooks`, API clients in `client/src/services`, and CSS modules readable without global leakage or duplicated state machines.
- Mobile maintainability: keep Dart feature code modular under `mobile/lib/src`, use Flutter tests for widget or contract behavior, and do not duplicate backend anti-fraud rules in ways that can drift.
- Reviewability: diffs should make risk visible with clear names, narrow files, documented acceptance criteria, and no generated/vendor/lockfile churn unless directly required.

## Tools
- `npm run lint --prefix client`
- `npm run server:build`
- `npm run server:test:unit`

## Severity
- blocker: A change creates architectural drift that makes product/security rules unenforceable, bypasses the documented source of truth, or introduces schema/provider behavior without required migration/story/decision proof.
- warning: A change is maintainable in principle but too broad, under-documented, duplicated across layers, over-mocked, or missing quick validation evidence.
- note: A localized naming, factoring, documentation, or cleanup suggestion that improves future review without blocking the change.
