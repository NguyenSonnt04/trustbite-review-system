# Validation

## Current Proof State

Implemented on 2026-07-08.

The route/service slice now supports strict list query validation, PostGIS
radius filtering, distance projection, minimum trust-score filtering,
deterministic sorting, and `/api/v1/restaurants/nearby` map-bounds lookup before
dynamic restaurant-id routes.

## Required Commands

Verified locally:

```bash
npm run db:migrate
npm run test:unit --prefix server -- tests/unit/restaurant/restaurantController.test.js
npm run test:integration --prefix server -- tests/integration/restaurantSearch.integration.test.js
npm run server:build
npm run harness -- story verify TB-REST-002
```

Results:

- `db:migrate`: applied 0 migration(s).
- Unit proof: 13 files / 115 tests passed.
- Integration proof: 7 files passed, 1 skipped; 63 tests passed, 2 skipped.
- `server:build`: syntax check passed for 91 files.

## Required Scenarios

| Scenario | Proof type |
| --- | --- |
| Reject malformed numeric search params | Integration |
| Reject incomplete coordinate pairs | Integration |
| Reject radius without coordinates | Integration |
| Reject `distanceAsc` without coordinates | Integration |
| Return active, non-deleted restaurants only | Integration |
| Keyword search matches restaurant name | Integration |
| Radius filter uses PostGIS and returns only restaurants within radius | Integration |
| `minTrustScore` filters by trust score | Integration |
| `name`, `trustScoreDesc`, and `distanceAsc` produce deterministic order | Integration |
| `/restaurants/nearby` returns restaurants inside viewport bounds | Integration |
| `/restaurants/nearby` rejects `northEastLng <= southWestLng` because antimeridian wrapping is out of scope | Integration |
| `/restaurants/nearby` is not captured by `/:restaurantId` route | Integration |

## Harness Closeout

Closeout state:

- DB migration ran locally.
- Required scenarios are covered by DB-backed integration tests.
- `server:build` passed.
- A real `verify_command` is attached to the Harness story.
- Trace evidence includes commands and results.
