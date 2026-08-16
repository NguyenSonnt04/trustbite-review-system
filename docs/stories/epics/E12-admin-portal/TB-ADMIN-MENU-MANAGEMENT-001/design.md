# Design

## Domain Model

The existing `menu_items` table remains authoritative. Management is limited to
`name`, `price_default`, `currency`, and `status` (`ACTIVE` or `ARCHIVED`).
Archiving replaces destructive deletion.

## Application Flow

The browser calls same-origin Next.js BFF routes. Express validates the
server-only BFF credential and opaque admin session, then the service rechecks
the actor's active local `ADMIN` or `SUPER_ADMIN` role.

The admin restaurant detail modal loads menu items independently from profile
and image data. Successful create and update operations reload server truth.

## Interface Contract

- `GET /api/v1/admin-web/restaurants/:restaurantId/menu`
  returns active and archived menu items for a non-deleted restaurant.
- `POST /api/v1/admin-web/restaurants/:restaurantId/menu`
  accepts `name`, `price`, optional `currency`, optional `status`, and `reason`.
- `PATCH /api/v1/admin-web/restaurants/:restaurantId/menu/:menuItemId`
  accepts at least one of `name`, `price`, `currency`, or `status`, plus
  `reason`.

Unknown fields, invalid UUIDs, blank or overlong names, negative or non-finite
prices, unsupported currencies or statuses, and reasons outside 10 to 500
characters are rejected.

## Data Model

No migration is required. Create and update run in transactions and write
`MENU_ITEM_CREATE` or `MENU_ITEM_UPDATE` rows to `audit_logs`.

## UI / Platform Impact

The existing admin restaurant modal gains a responsive menu workspace with
loading, error, empty, create, edit, archive, and reactivate states. Public and
mobile menu reads remain unchanged.

## Observability

Audit metadata records changed fields, restaurant ID, item name, price,
currency, and status without storing credentials or session data.

## Alternatives Considered

1. Use public restaurant routes for mutations. Rejected because public routes
   are not the admin authorization boundary.
2. Hard-delete menu items. Rejected because archival preserves auditability and
   existing branch references.
