# Exec Plan

## Goal

Separate restaurant business status (`CLOSED`) from logical deletion (`is_deleted`) by adding dedicated soft-delete columns and updating Restaurant CRUD API persistence logic.

## Scope

### In scope

- Add restaurant soft-delete database columns: `is_deleted`, `deleted_at`.
- Add an index for default query filtering.
- Update `RestaurantModel`.
- Update restaurant service read/list/update/delete queries.
- Update related story evidence and decision record.

### Out of scope

- Auth or authorization for DELETE.
- Audit log records.
- Admin restore endpoint.
- Cascading soft delete to reviews, branches, menus, or claims.
- UI changes.

## Risk Classification

### Risk flags

- Data model: migration adds columns to `restaurants`.
- Public contracts: DELETE semantics remain externally stable but persistence semantics change.
- Existing behavior: previous soft delete used `status = 'CLOSED'`.
- Weak proof: soft-delete semantics need DB-backed API regression proof.

### Hard gates

- Data model change: high-risk.

## Work Phases

1. **Discovery**
   - Read restaurant model, migration schema, CRUD story, and current service queries.
2. **Design**
   - Record durable decision `0007-restaurant-soft-delete-is-deleted.md`.
   - Create this high-risk story packet.
3. **Validation planning**
   - Define API/database smoke checks.
4. **Implementation**
   - Add migration.
   - Update model and service.
   - Keep controller response contract stable.
5. **Verification**
   - Run `npm run db:migrate`.
   - Run targeted restaurant controller/CRUD Vitest proof.
   - Run `npm run server:build`.
6. **Harness update**
   - Attempt `npm run harness -- query matrix` and record result.

## Stop Conditions

Pause for human confirmation if:

- Soft-delete must cascade into related tables.
- Restore / undelete behavior is required.
- DELETE must become non-idempotent.
- Migration rollback behavior must be implemented now.
