# TB-FRAUD-002 GPS/Haversine Proximity Rule

## Status

implemented

## Lane

normal

## Product Contract

TrustBite backend code provides a deterministic GPS proximity rule that calculates Haversine distance in meters between device coordinates and restaurant coordinates, then compares the distance against an explicit threshold. The default accepted threshold is 200 meters, sourced from server anti-fraud configuration (`GPS_PROXIMITY_THRESHOLD_METERS`).

This story is intentionally backend-only: it proves the domain/service rule without adding UI, public API shape, persistence, review mutation, or trust-score mutation.

## Relevant Product Docs

- `docs/product/verification.md`
- `docs/product/README.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_MATRIX.md`

## Acceptance Criteria

- Backend service code calculates Haversine distance in meters for valid latitude/longitude pairs.
- Backend service code evaluates proximity as passing when distance is less than or equal to the configured threshold.
- The default GPS proximity threshold is explicit, configurable through server anti-fraud config, and documented as 200 meters.
- Invalid latitude, longitude, or threshold values are rejected before producing a verification result.
- Unit tests cover zero-distance, inside-threshold, boundary-threshold, outside-threshold, custom-threshold, and invalid-input cases.
- No client/UI changes, database migrations, provider calls, review status changes, or trust-score changes are included in this slice.

## Design Notes

- Commands: targeted Vitest unit test, full server unit suite, server syntax build, Harness matrix query, diff check.
- Queries: none.
- API: none in this slice.
- Tables: none in this slice.
- Domain rules: Haversine distance; `distance_meters <= threshold_meters`; default config threshold `200`.
- UI surfaces: none.

## Validation

When updating durable proof status, use numeric booleans:
`npm run harness -- story update --id TB-FRAUD-002 --unit 1 --integration 0 --e2e 0 --platform 0`

| Layer | Expected proof |
| --- | --- |
| Unit | `npm run test:unit --prefix server -- tests/unit/verification/gpsProximityService.test.js` |
| Integration | Not required for this pure backend rule slice; later route/persistence stories must add integration proof. |
| E2E | Not required; no UI flow in scope. |
| Platform | Not required; no provider/container behavior in scope. |
| Release | `npm run server:build`, `npm run harness -- query matrix`, `git diff --check` |

## Harness Delta

Created a focused story packet and product verification doc because the previously simulated 200m GPS rule needed to become an accepted backend contract before implementation.

## Evidence

Validated on 2026-07-04:

- `npm run test --prefix server -- tests/unit/verification/gpsProximityService.test.js` — passed 1 file / 13 tests.
- `npm run test:unit --prefix server` — passed 7 files / 80 tests.
- `npm run server:build` — syntax check passed for 81 files.
- `npm run harness -- story update --id TB-FRAUD-002 --status implemented --unit 1 --integration 0 --e2e 0 --platform 0 --evidence "..."` — durable story row updated.
- `npm run harness -- query matrix` — shows `TB-FRAUD-002` implemented with unit proof.
- `git diff --check` — passed.

PR #31 Greptile follow-up on 2026-07-04:

- Moved default GPS threshold source to `server/src/config/antiFraud.js` with `GPS_PROXIMITY_THRESHOLD_METERS` env parsing.
- Kept `GpsProximityValidationError` domain-only by removing HTTP `statusCode` coupling.
- Expanded invalid threshold proof for negative and infinite values.
