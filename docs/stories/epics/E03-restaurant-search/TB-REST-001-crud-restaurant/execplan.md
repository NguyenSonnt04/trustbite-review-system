# Execution Plan

## Goal

Prove the existing restaurant CRUD API against the accepted PostgreSQL schema,
public visibility rules, and route authorization boundary before marking the
story implemented.

## Scope

In scope:

- Create, update, and soft-delete restaurant records through existing Express
  routes and services.
- Keep `geo` synchronized with `latitude` and `longitude` on writes.
- Validate accepted restaurant fields, status values, UUIDs, coordinates, and
  category IDs at HTTP/service boundaries.
- Prove category mappings, slug collision retry, transactions, and rollback or
  cleanup behavior against local PostgreSQL.

Out of scope:

- Search/filter/nearby API expansion.
- Public detail/review listing closeout.
- New restaurant fields, indexes, migrations, or ownership tables.
- UI/mobile work.

## Risk Classification

Risk flags:

- Data model.
- Public contracts.
- Existing behavior.
- Weak proof.

Hard gates:

- Data-model/persistence behavior.
- Public API behavior.

Lane: high-risk.

## Work Phases

1. Re-read `docs/product/restaurant-discovery.md`, `server/migrations/`, and
   the current restaurant route/controller/service/model files.
2. Add the smallest DB-backed failing integration test for one CRUD behavior.
3. Make the smallest code fix only when a test exposes a real gap.
4. Repeat for create, update, soft-delete, category mapping, slug retry, and
   `geo` synchronization.
5. Run `npm run db:migrate`, the focused restaurant proof command, and
   `npm run server:build`.
6. Attach a real Harness `verify_command` only after the focused proof exists
   and has passed.
7. Refresh story validation evidence, Harness matrix, and trace evidence.

## Stop Conditions

Pause for human confirmation if:

- Production create/update/delete authorization must change from authenticated
  internal API to admin/owner-only authorization.
- Existing migrations do not support the required CRUD contract.
- A schema/index change appears necessary.
- Local PostgreSQL/PostGIS cannot run, making DB-backed proof impossible.
- Validation requirements would need to be weakened.
