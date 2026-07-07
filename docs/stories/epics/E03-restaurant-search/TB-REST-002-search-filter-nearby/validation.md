# Validation

## Current Proof State

No implementation proof yet. Current code does not support the full query
contract and does not expose `/api/v1/restaurants/nearby`.

## Required Commands

Use these only after the relevant tests exist:

```bash
npm run db:migrate
npm run test:unit --prefix server -- tests/unit/restaurant/restaurantController.test.js
npm run test:integration --prefix server -- tests/integration/restaurant/restaurantSearch.test.js
npm run server:build
```

If the repository does not yet have `server` integration scripts for this path,
add the smallest practical test command before marking this story implemented.

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

Do not set this story to `implemented` until:

- DB migration has been run locally.
- Tests above pass.
- `npm run server:build` passes.
- A real `verify_command` is attached to the Harness story.
- Trace evidence includes commands and results.
