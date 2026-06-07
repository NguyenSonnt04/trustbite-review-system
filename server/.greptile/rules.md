# Server Review Rules

Applies to `server/`.

## Stack

- Node.js.
- Express.
- Native ES modules.
- PostgreSQL via `pg`.
- AWS SDK integrations behind config/services.
- LocalStack for local AWS simulation.

## Backend rules

- Keep route declarations in `src/routes/`.
- Keep request/response orchestration in `src/controllers/`.
- Keep business logic, provider calls, OCR, geo, auth, and persistence coordination in `src/services/`.
- Keep env, DB, and AWS setup in `src/config/`.
- Middleware should handle cross-cutting concerns such as auth, error handling, and request validation.
- Do not swallow async errors silently.
- Do not leak provider errors, stack traces, credentials, JWT claims, or sensitive internals in public responses.
- API errors should be predictable and documented when public behavior changes.
- Auth/Cognito/JWT logic is security-sensitive and should be reviewed strictly.
- AWS provider behavior changes are high-risk and need matching docs/story updates.
- Database schema, persistence, duplicate receipt policy, deletion, retention, or uniqueness behavior changes need explicit validation and documentation.
