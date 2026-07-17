# TB-MOBILE-MENU-001: Show Digital Menu And Public Reviews

## Status

implemented

## Lane

high-risk

## Product Contract

Restaurant detail users can read the restaurant's active electronic menu from
the backend. Public verified and reference-only reviews appear below the menu
with the backend-issued reviewer display name.

## Relevant Product Docs

- `docs/product/restaurant-discovery.md`
- `docs/ARCHITECTURE.md`

## Acceptance Criteria

- `GET /api/v1/restaurants/:restaurantId/menu` returns only active
  `menu_items` for an active, non-deleted restaurant.
- Menu responses expose ID, name, default price, and currency using stable
  pagination and ordering.
- Mobile restaurant detail renders menu loading, success, empty, failure, and
  retry states without hiding the restaurant profile.
- Menu cards use backend data and do not invent dish images or branch prices.
- Public reviews load from
  `GET /api/v1/restaurants/:restaurantId/reviews`.
- Review loading, empty, failure, retry, verified, and reference-only states
  remain independent from restaurant detail and menu loading.
- Mobile renders `reviewerDisplayName` from the public API and does not invent
  avatars, helpful counts, replies, or media.
- Deleted or unnamed reviewers use the backend fallback
  `Người dùng TrustBite`; private identity fields remain omitted.

## Design Notes

- APIs:
  - `GET /api/v1/restaurants/:restaurantId/menu?page=1&pageSize=50`
  - `GET /api/v1/restaurants/:restaurantId/reviews?status=ALL&page=1&pageSize=20`
- Tables: `restaurants`, `menu_items`
- Domain rules: public restaurant gate, `menu_items.status = 'ACTIVE'`,
  `price_default` only.
- UI surfaces: `RestaurantDetailPage`.
- Public review cards show the backend-issued display name and trust state.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | Controller validation plus mobile menu and public review parsing |
| Integration | Public menu visibility, filtering, ordering, pagination, and empty behavior |
| E2E | Detail page shows menu before public reviews and retries both sections independently |
| Platform | Flutter analyze and Android debug APK |
| Release | Full server and mobile suites |

## Harness Delta

Registered `TB-MOBILE-MENU-001` with focused server, syntax, and full mobile
verification.

## Evidence

- Harness story verification passed:
  - focused menu controller and integration contracts: 17 passed;
  - server syntax: 133 files;
  - full Flutter suite: 52 passed, including public review parsing,
    rendering, and section retry coverage.
- `flutter analyze`: no issues.
- Android debug APK built successfully.
- Local API smoke returned a valid empty menu envelope for an active
  restaurant. Current seed data has no active menu items.
- Local API smoke returned a valid empty public-review envelope. Current seed
  data has no public reviews.
- Full server suite reached 552 passed and 4 skipped, with 3 unrelated failures
  in concurrent admin restaurant bulk-deletion work.
- Harness trace: `#71`.
- 2026-07-16 reviewer-name privacy contract:
  - public review API returns trimmed `reviewerDisplayName`;
  - deleted or unnamed authors return `Người dùng TrustBite`;
  - private identity and receipt fields remain omitted;
  - 559 server tests and 62 mobile tests passed on this branch;
  - server syntax and Flutter analyze passed.
- Decision: `docs/decisions/0027-public-reviewer-display-name.md`.
