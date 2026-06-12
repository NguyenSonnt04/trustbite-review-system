# Overview

## Current Behavior

The restaurant soft-delete is implemented by setting `status = 'CLOSED'` on the `restaurants` row.

```sql
UPDATE restaurants SET status = 'CLOSED' WHERE id = $1 RETURNING id
```

This conflates the business-level status (`CLOSED` = restaurant stopped operations) with the data lifecycle status (soft-deleted). A restaurant that is genuinely closed for business cannot be represented correctly under this model because the application cannot distinguish between `CLOSED` (business) and `CLOSED` (soft-deleted).

## Target Behavior

We introduce dedicated column flags to the `restaurants` table:

- `is_deleted BOOLEAN NOT NULL DEFAULT FALSE`
- `deleted_at TIMESTAMPTZ`

All read, list, and update queries filter out soft-deleted records via `WHERE is_deleted = FALSE`. The `DELETE /api/v1/restaurants/:restaurantId` endpoint sets `is_deleted = TRUE, deleted_at = NOW()` instead of modifying `status`.

## Affected Users

- Backend developers and API consumers (clients sending DELETE requests will still receive `200` with `success: true`, but the underlying mutation changes to `is_deleted` instead of `status`).
- Admins performing restaurant moderation (future story).
- End users: unaffected, because the public list already filters out non-ACTIVE restaurants. Soft-deleted records are never visible through public endpoints.

## Affected Product Docs

- `docs/decisions/0007-restaurant-soft-delete-is-deleted.md`
- `server/migrations/002_add_restaurant_soft_delete.sql`
- `server/src/models/restaurant/restaurant.js`
- `server/src/services/restaurantService.js`

## Non-Goals

- Do not cascade soft-delete to related tables (`reviews`, `restaurant_branches`, `menu_items`, `restaurant_claims`). The restaurant record is the only atomic subject of this deletion.
- Do not implement hard-delete or permanent removal for restaurants.
- Do not add an admin recovery API for soft-deletion; that remains a future story.
