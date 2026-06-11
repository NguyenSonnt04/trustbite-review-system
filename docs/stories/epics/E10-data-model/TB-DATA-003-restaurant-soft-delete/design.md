# Design

## Domain Model

Restaurant has two separate lifecycle concepts:

1. **Business status** via `status`:
   - `DRAFT`: record exists but is not publicly visible.
   - `ACTIVE`: publicly visible.
   - `SUSPENDED`: temporarily disabled or under moderation.
   - `CLOSED`: restaurant has closed as a business but remains a valid historical domain entity.

2. **Data lifecycle status** via `is_deleted`:
   - `FALSE`: normal domain row.
   - `TRUE`: logically deleted from regular application flows.

`deleted_at` records when the soft deletion happened.

## Application Flow

- `GET /api/v1/restaurants` only returns `ACTIVE` and `is_deleted = FALSE` records.
- `GET /api/v1/restaurants/:restaurantId` returns 404 if the row is missing or `is_deleted = TRUE`.
- `PATCH /api/v1/restaurants/:restaurantId` updates only rows where `is_deleted = FALSE`.
- `DELETE /api/v1/restaurants/:restaurantId` sets `is_deleted = TRUE, deleted_at = NOW()` for an existing non-deleted row.
- A repeated DELETE for an already soft-deleted row returns `404 RESTAURANT_NOT_FOUND` because deleted rows are excluded from regular application flows.

## Interface Contract

No new public API request fields are required.

DELETE response remains:

```json
{
  "success": true,
  "message": "Restaurant has been soft-deleted."
}
```

## Data Model

Migration:

```sql
ALTER TABLE restaurants
  ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN deleted_at TIMESTAMPTZ;

CREATE INDEX idx_restaurants_is_deleted_status ON restaurants(is_deleted, status);
```

Model update:

```js
this.is_deleted = data.is_deleted ?? false;
this.deleted_at = data.deleted_at ? new Date(data.deleted_at) : null;
```

## UI / Platform Impact

None in this story. Current client surfaces do not expose Restaurant CRUD UI.

## Observability

No audit table exists yet for restaurant deletion. The mutation timestamp is stored in `deleted_at`. A future audit story should record who performed the delete.

## Alternatives Considered

- Continue using `status = 'CLOSED'`: rejected because it conflates business closure with deletion.
- Hard delete: rejected because downstream records such as reviews, branches, menus, and claims should not be physically removed by a standard API delete.
