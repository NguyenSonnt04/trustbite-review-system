# Execution Plan

## TDD Sequence

1. Add failing integration tests for `GET /api/v1/restaurants` validation:
   malformed numeric values, incomplete coordinate pairs, invalid radius,
   invalid trust score, invalid sort, and `distanceAsc` without coordinates.
2. Add failing integration tests for active/non-deleted filtering.
3. Add failing integration tests for keyword plus radius filtering.
4. Add failing integration tests for `minTrustScore`.
5. Add failing integration tests for `name`, `trustScoreDesc`, and
   `distanceAsc` sorting.
6. Add failing integration tests for `GET /api/v1/restaurants/nearby`,
   including route ordering and invalid bounds.
7. Implement controller parsing helpers only as needed.
8. Extend `restaurantService.listRestaurants` with parameterized SQL filters.
9. Add `restaurantService.listNearbyRestaurants`.
10. Wire `listNearbyRestaurantsHandler` and route ordering.
11. Refactor shared pagination/numeric parsing when tests are green.
12. Add the real Harness `verify_command`.

## Files Expected To Change

- `server/src/routes/restaurant.js`
- `server/src/controllers/restaurant.js`
- `server/src/services/restaurantService.js`
- `server/tests/...` restaurant integration tests
- `docs/stories/epics/E03-restaurant-search/TB-REST-002-search-filter-nearby/validation.md`
- Harness story record and trace evidence

## Risk Controls

- Keep public visibility filtering in every query.
- Keep `nearby` route before `/:restaurantId`.
- Do not fetch all restaurants and filter distance in application memory.
- Keep numeric parsing strict.
- Keep DB fixtures isolated and rolled back or cleaned up.
