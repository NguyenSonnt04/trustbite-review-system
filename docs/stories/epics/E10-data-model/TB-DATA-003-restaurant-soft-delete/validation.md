# Validation

## Proof Strategy

Manual curl smoke through all 5 CRUD endpoints after running the migration. No automated backend test script exists (see `docs/ARCHITECTURE.md` Current Gaps).

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Verify `deleteRestaurant` sets `is_deleted = TRUE`, `deleted_at != NULL`; repeated call returns false (row already deleted); update and getById filter `is_deleted = FALSE`. |
| Integration | `DELETE /api/v1/restaurants/:id` → `200 { success: true }`; DB row has `is_deleted = true`, `deleted_at` set. Second DELETE same id → `404`. `GET /api/v1/restaurants/:id` after delete → `404`. `GET /api/v1/restaurants` does not include soft-deleted rows. `PATCH` on soft-deleted id → `404`. `status = 'CLOSED'` for a non-deleted restaurant is still a valid business status and does not affect data lifecycle. |
| E2E | Out of scope (no UI surface). |
| Platform | Not applicable. |
| Performance | Not applicable. |
| Logs/Audit | `deleted_at` column is set on delete. No audit log for this story (future story). |

## Fixtures

```sql
-- Seed one ACTIVE restaurant and one soft-deleted restaurant
INSERT INTO restaurants (name, slug, status, is_deleted)
VALUES
  ('Open Restaurant', 'open-restaurant-abc123', 'ACTIVE', FALSE),
  ('Deleted Restaurant', 'deleted-restaurant-def456', 'ACTIVE', TRUE);
```

## Commands

```bash
npm run docker:up
npm run db:migrate
npm run dev
```

Manual smoke:

```bash
# Soft delete
curl -i -X DELETE http://localhost:5000/api/v1/restaurants/<ACTIVE_ID>
# Expected: 200 { success: true, message: 'Restaurant has been soft-deleted.' }
# DB check: is_deleted = true, deleted_at IS NOT NULL

# Repeated delete
curl -i -X DELETE http://localhost:5000/api/v1/restaurants/<ACTIVE_ID>
# Expected: 404 RESTAURANT_NOT_FOUND (already deleted and excluded from regular flows)

# GET after delete
curl -i http://localhost:5000/api/v1/restaurants/<DELETED_ID>
# Expected: 404 RESTAURANT_NOT_FOUND

# List does not include soft-deleted
curl -i http://localhost:5000/api/v1/restaurants
# Expected: deleted restaurant absent from items

# CLOSED business status is still valid for non-deleted restaurant
curl -i -X PATCH http://localhost:5000/api/v1/restaurants/<ANOTHER_ID> \
  -H 'Content-Type: application/json' \
  -d '{"status":"CLOSED"}'
# Expected: 200, restaurant row has status=CLOSED, is_deleted=false
```

## Acceptance Evidence

- Migration applied without error.
- All smoke checks above pass.
- Story status updated to `done`.
