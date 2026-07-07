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

Do not attach a Harness `verify_command` until the integration command exists
and proves the behavior above.

Expected closeout command shape:

```text
npm run db:migrate
npm run test:integration --prefix server -- <focused restaurant CRUD integration tests>
npm run server:build
```

## Acceptance Evidence

Pending. CRUD still lacks durable local database proof.
