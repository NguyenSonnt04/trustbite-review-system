# Validation

## Proof Strategy

Validate the migration runner syntax, SQL execution against local PostgreSQL
when available, and post-migration table count.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | `node --check server/scripts/migrate.js` |
| Integration | `npm run db:migrate` against local PostgreSQL |
| E2E | Not applicable |
| Platform | Docker PostGIS image starts through `npm run docker:up` |
| Performance | Not applicable |
| Logs/Audit | Migration logs applied/skipped versions |

## Fixtures

No seed fixtures in this story.

## Commands

```text
npm run docker:up
npm run db:migrate
```

## Acceptance Evidence

- `node --check server/scripts/migrate.js` passed.
- `npm run docker:up` started PostgreSQL using the PostGIS-capable image.
- First `npm run db:migrate` applied `001_init_schema.sql`.
- Verification query found 54 TrustBite application tables, excluding
  PostGIS `spatial_ref_sys` and runner-owned `schema_migrations`.
- Verification query found enabled extensions: `pgcrypto`, `postgis`.
- Second `npm run db:migrate` skipped `001_init_schema.sql` and applied 0
  migrations, proving idempotent migration tracking.
- `npm run harness -- query matrix` remains blocked locally because
  `scripts/bin/harness-cli` is not installed.
