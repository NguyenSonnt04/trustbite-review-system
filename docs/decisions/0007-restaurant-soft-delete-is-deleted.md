# 0007 Soft Delete for Restaurants using is_deleted

Date: 2026-06-10

## Status

Accepted

## Context

Initially, the soft-delete requirement in the restaurant domain (TB-REST-001) was implemented by updating the `status` column to `'CLOSED'`.
However, `'CLOSED'` is a business-level status representing that a restaurant has permanently or temporarily ceased business operations. A restaurant that is closed for business is still a valid domain entity that should exist in the database, keep its history of reviews, and be searchable for historic purposes.
In contrast, a soft delete represents a logical deletion from the application system, typically triggered by administrative actions. Soft-deleted entities should be filtered out from all default domain queries (listings, details, updates) and should not be accessible through regular APIs.
Using `status = 'CLOSED'` for soft deletion conflicts with its business meaning and creates ambiguity.

## Decision

We will introduce a dedicated logical deletion flag to the `restaurants` table:
1. Add `is_deleted` (boolean, defaults to `FALSE`) and `deleted_at` (timestamptz, defaults to `NULL`).
2. Add a database migration `002_add_restaurant_soft_delete.sql` to alter the `restaurants` table.
3. Update the `RestaurantModel` class to include `is_deleted` and `deleted_at`.
4. Update all read, list, and write queries in `restaurantService.js` to enforce the filter `is_deleted = FALSE`.
5. Update `deleteRestaurant` to set `is_deleted = TRUE` and `deleted_at = NOW()` instead of mutating `status = 'CLOSED'`.
6. Leave `status = 'CLOSED'` purely as a business-level indicator of closure.

## Alternatives Considered

- **Keep status = 'CLOSED' for soft delete**: Rejected because it prevents a restaurant from being marked as business-closed while remaining active in the database index (e.g. users still browsing historical reviews for a closed restaurant).
- **Physical DELETE**: Rejected due to foreign key cascade deletion constraints on reviews, branches, menus, claims, etc. Soft-deletion is required to preserve auditability and referential integrity.

## Consequences

- **Positive:** Clear separation between business status lifecycle (`DRAFT`, `ACTIVE`, `SUSPENDED`, `CLOSED`) and data lifecycle (`is_deleted`). Closed restaurants can still be kept in search history with their review list.
- **Tradeoffs:** Every DB query selecting or updating restaurants must explicitly filter by `is_deleted = FALSE` to prevent deleted records from leaking.
- **Consequence on dependent tables:** Future stories must decide whether deleting a parent restaurant cascadingly marks branches or reviews as deleted, or relies on foreign key triggers. For this story, we only soft-delete the restaurant record.

## Follow-Up

Implement the migration and update the restaurant model, service, and controller endpoints.
