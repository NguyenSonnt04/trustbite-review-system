# Validation

## Proof Strategy

Automated DB-backed Vitest integration proof through the public Restaurant CRUD API after running migrations. This story does not claim UI, mobile, admin UI, restore API, audit log, or cascade behavior.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Not separately claimed for the soft-delete service path; targeted controller unit proof remains part of the verify command. |
| Integration | `DELETE /api/v1/restaurants/:id` -> `200 { success: true }`; DB row has `is_deleted = true`, `deleted_at` set. Second DELETE same id -> `404`. `GET /api/v1/restaurants/:id` after delete -> `404`. `GET /api/v1/restaurants` does not include soft-deleted rows. `PATCH` on soft-deleted id -> `404`. `status = 'CLOSED'` for a non-deleted restaurant is still a valid business status and does not affect data lifecycle. |
| E2E | Out of scope; no UI surface. |
| Platform | `npm run db:migrate` proves the local PostgreSQL migration state before DB-backed tests. |
| Performance | Not applicable. |
| Logs/Audit | `deleted_at` column is set on delete. No audit log for this story; future story. |

## Fixtures

Integration tests create restaurants through the public CRUD API and remove test rows in `finally` cleanup. The soft-delete assertions read the persisted restaurant row to prove `is_deleted`, `deleted_at`, and `status` semantics.

## Commands

```bash
npm run db:migrate
npm run test --prefix server -- tests/unit/restaurant/restaurantController.test.js tests/integration/restaurantCrud.integration.test.js
npm run server:build
npm run harness -- story verify TB-DATA-003
```

## Acceptance Evidence

2026-07-08:

- `npm run db:migrate` passed; migration runner skipped already-applied files and applied 0 migrations.
- `npm run test --prefix server -- tests/unit/restaurant/restaurantController.test.js tests/integration/restaurantCrud.integration.test.js` passed: 2 files, 14 tests.
- `npm run server:build` passed: syntax check for 104 files.
- `npm run harness -- story verify TB-DATA-003` passed with the same migrate/test/build chain.
- Integration coverage proves soft-delete persistence, repeated DELETE 404, GET/detail exclusion, list exclusion, PATCH exclusion, and `status = 'CLOSED'` remaining distinct from `is_deleted`.
