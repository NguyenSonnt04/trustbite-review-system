# TB-REST-002: Restaurant Search, Filters, and Nearby Lookup

## Status

implemented

## Lane

high-risk

## Product Contract

Implement the Phase 3 public restaurant discovery API for keyword search,
location radius search, trust-score filtering, deterministic sorting, and map
viewport lookup. This story covers backend behavior only; web/mobile UI tasks
consume the API later.

## Relevant Product Docs

- `docs/product/restaurant-discovery.md`
- `docs/stories/epics/E03-restaurant-search/phase-3-implementation-plan.md`
- `trustbite-docs/04_Software_Engineering/API_Specification.md` section 4
- `trustbite-docs/04_Software_Engineering/openapi.yaml` restaurant paths
- `trustbite-docs/02_Business_Analysis/Business_Rules.md` BR-REST-001
- `docs/ARCHITECTURE.md`
- `docs/CONTEXT_RULES.md`

## Acceptance Criteria

- `GET /api/v1/restaurants` accepts `keyword`, `lat`, `lng`,
  `radiusMeters`, `minTrustScore`, `sort`, `page`, and `pageSize`.
- Location search validates `lat/lng` as a pair and defaults missing
  `radiusMeters` to 5000 meters.
- `radiusMeters` is limited to `[1, 50000]`.
- `minTrustScore` filters restaurants by `restaurants.trust_score` in `[0, 5]`.
- `sort` supports `name`, `trustScoreDesc`, and `distanceAsc`.
- `distanceAsc` requires `lat/lng`.
- Results always exclude non-active and soft-deleted restaurants.
- Radius filtering and distance ordering use PostGIS, not JavaScript distance
  loops after fetching unbounded rows.
- `GET /api/v1/restaurants/nearby` accepts viewport bounds and returns active
  restaurants inside the map rectangle.
- `/restaurants/nearby` is routed before `/:restaurantId` and is not treated as
  a restaurant UUID.
- Responses keep the existing page envelope and camelCase item fields.

## Non-Goals

- UI restaurant search screens.
- External map SDK/provider integration.
- Trust-score recalculation.
- New search indexes unless tests prove the existing schema cannot satisfy the
  Phase 3 contract.

## Validation Summary

Closeout proof recorded on 2026-07-08:

- `npm run db:migrate`
- `npm run test:unit --prefix server -- tests/unit/restaurant/restaurantController.test.js`
- `npm run test:integration --prefix server -- tests/integration/restaurantSearch.integration.test.js`
- `npm run server:build`
- `npm run harness -- story verify TB-REST-002`
