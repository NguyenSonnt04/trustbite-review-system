# REST-US-003: Restaurant Detail and Verified Reviews

## Status

implemented

## Lane

normal

## Product Contract

Theo API_Specification.md và Traceability_Matrix.md; restaurant detail phải trả review verified/reference rõ ràng.

## Relevant Product Docs

- `trustbite-docs/04_Software_Engineering/API_Specification.md`
- `trustbite-docs/00_Document_Control/Traceability_Matrix.md`

## Acceptance Criteria

- `GET /api/v1/restaurants/:restaurantId/reviews` must return paginated list of reviews with status filter (VERIFIED, REFERENCE_ONLY, ALL).
- The response must differentiate `VERIFIED` and `REFERENCE_ONLY` clearly.
- Hidden, rejected, and deleted reviews must not be returned in public endpoints.
- Non-public reviews (`public_visibility != 'PUBLIC'`) must not be returned in public endpoints.
- `GET /api/v1/restaurants/:restaurantId` should populate `ratingBreakdown` and `ownerClaimStatus` if available.
- Both endpoints must return 404 for non-ACTIVE restaurants (DRAFT, SUSPENDED, CLOSED).

## Design Notes

- Commands: N/A
- Queries: `listPublicReviewsByRestaurant` with pagination and status filter.
- API: `GET /api/v1/restaurants/:restaurantId/reviews` and `GET /api/v1/restaurants/:restaurantId`
- Tables: `restaurants`, `reviews`, `restaurant_claims`
- Domain rules:
  - Public listing excludes unverified, hidden, rejected, deleted, and non-public visibility reviews.
  - `getRestaurantDetail` enforces `r.status = 'ACTIVE'` — DRAFT/SUSPENDED/CLOSED return 404.
  - `ratingBreakdown` counts only reviews with `status IN ('VERIFIED', 'REFERENCE_ONLY') AND public_visibility = 'PUBLIC'`.
  - `/reviews` existence check uses `getRestaurantDetail` ensuring ACTIVE gate is consistent.
- UI surfaces: Mobile app restaurant detail page.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id REST-US-003 --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Controller input parsing; UUID validation; status param validation; pagination boundary |
| Integration | Postgres querying with pagination; ACTIVE gate; public_visibility filter; ratingBreakdown aggregate |
| E2E | |
| Platform | |
| Release | |

## Harness Delta

None.

## Evidence

- `GET /api/v1/restaurants/:restaurantId` implemented via `getRestaurantDetail`:
  - Queries `restaurants` with `r.status = 'ACTIVE' AND r.is_deleted = FALSE` — DRAFT/SUSPENDED/CLOSED return 404.
  - Populates `ratingBreakdown` using only reviews where `status IN ('VERIFIED', 'REFERENCE_ONLY') AND public_visibility = 'PUBLIC'`.
  - Populates `ownerClaimStatus` from latest `restaurant_claims` row (null if none).
- `GET /api/v1/restaurants/:restaurantId/reviews` implemented via `listPublicReviewsByRestaurant`:
  - Existence check uses `getRestaurantDetail` so only ACTIVE restaurants pass.
  - SQL WHERE clause: `restaurant_id = $1 AND <statusCondition> AND public_visibility = 'PUBLIC'`.
  - `statusCondition` is one of: `status = 'VERIFIED'`, `status = 'REFERENCE_ONLY'`, or `status IN ('VERIFIED', 'REFERENCE_ONLY')` for ALL.
  - `userId` omitted from public response per API spec.
- Route import cleanup: `listPublicReviewsByRestaurant` import moved to top of controller file (line 18).
- Syntax check: `node --check` passes on all four changed files (controller, restaurantService, reviewService, routes).
- Handlers wired in `server/src/routes/restaurant.js`.
