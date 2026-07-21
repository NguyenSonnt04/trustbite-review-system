# Admin Electronic Menu Management

## Current Behavior

The public restaurant API exposes active menu items, but the admin portal cannot
view archived items or create and edit electronic menu records.

## Target Behavior

`ADMIN` and `SUPER_ADMIN` users can open a restaurant in the admin portal, view
its complete electronic menu, add menu items, edit names and default prices,
and archive or reactivate items. Every mutation requires an administrative
reason and creates an audit record.

## Affected Users

- `ADMIN`
- `SUPER_ADMIN`

## Affected Product Docs

- `docs/product/restaurant-discovery.md`
- `docs/decisions/0024-admin-restaurant-management-bff.md`

## Non-Goals

- Dish images, descriptions, categories, or display ordering.
- Branch-specific prices and availability.
- Permanent menu-item deletion.
- Merchant self-service menu management.
