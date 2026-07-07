# Validation

## Proof Strategy

Use DB-backed tests as the primary contract proof because the acceptance
criteria depend on PostgreSQL constraints, PostGIS `geo` behavior, category
mapping, and transaction cleanup.

## Acceptance Criteria

- `POST /api/v1/restaurants` creates a restaurant with name, optional profile
  fields, optional coordinates, and optional category mappings.
- New restaurant writes keep `geo` synchronized with `latitude` and
  `longitude`.
- Slug generation is unique or retries safely on collision.
- `PATCH /api/v1/restaurants/:restaurantId` updates only accepted fields and
  keeps `geo` synchronized when coordinates change or are cleared.
- Status updates accept only `DRAFT`, `ACTIVE`, `SUSPENDED`, or `CLOSED`.
- `DELETE /api/v1/restaurants/:restaurantId` soft-deletes by setting
  `is_deleted = TRUE` and `deleted_at`.
- Public reads never return soft-deleted restaurants.
- Mutating routes require authenticated identity before service logic runs.
- Production authorization for who may create/update/delete restaurants is
  explicitly decided before this story is marked implemented.
- Error responses follow the standard `{ error: { code, message, requestId } }`
  envelope.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Boundary validation for missing name, invalid UUID, invalid status, malformed coordinates, and category IDs |
| Integration | PostgreSQL create/update/delete tests proving transactions, category mapping, soft-delete, slug retry, and `geo` sync |
| E2E | Not required for backend-only closeout |
| Platform | `npm run db:migrate` against local Postgres/PostGIS |
| Build | `npm run server:build` |

## Commands

```text
npm run db:migrate
npm run test:unit --prefix server -- tests/unit/restaurant/restaurantController.test.js
npm run test:integration --prefix server -- tests/integration/restaurantCrud.integration.test.js
npm run server:build
```

## Acceptance Evidence

Accepted on 2026-07-08.

- `npm run db:migrate` applied 0 pending migrations after the local schema was
  already current.
- `npm run test:unit --prefix server -- tests/unit/restaurant/restaurantController.test.js`
  passed 13 files / 115 tests.
- `npm run test:integration --prefix server -- tests/integration/restaurantCrud.integration.test.js`
  passed 6 files / 49 tests, with 1 skipped file / 2 skipped tests.
- `npm run server:build` passed syntax checks for 91 files.
- `npm run harness -- story verify TB-REST-001` passed with the command chain
  above.
- Decision 0016 documents that Phase 3 CRUD mutations stay behind the
  authenticated internal backend boundary until a future high-risk admin/owner
  authorization story narrows production exposure.
