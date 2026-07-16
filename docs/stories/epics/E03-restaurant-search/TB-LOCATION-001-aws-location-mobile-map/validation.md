# Validation

## Proof Strategy

Prove validation and provider command/normalization behavior with injected SDK
test doubles, prove route mounting through Express tests, prove Flutter API and
runtime parsing with unit/widget tests, and run syntax/build checks. A live AWS
smoke is optional and must not run without explicit credentials/resources.
LocalStack declaration is not evidence that the pinned community image supports
Amazon Location APIs.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Env parsing; AWS command inputs; normalization; controller negative coordinate/search/mode cases; Flutter API/runtime parsing. |
| Integration | Express routes return normalized data with an injected provider boundary and structured failures. |
| E2E | Manual mobile search, viewport restaurants, GPS, and route line against configured real AWS resources. |
| Platform | Android/iOS permissions; Flutter analyze/test/build; widget proof for full-canvas map, floating search, and draggable bottom-sheet bounds. |
| Performance | Search input is submit/debounce controlled; viewport lookup remains bounded to 250 items. |
| Logs/Audit | Errors do not expose API keys, credentials, search text, or coordinates. |

## Fixtures

- Deterministic AWS Location command results with one place and one route leg.
- Invalid/missing coordinate query combinations and unsupported modes.
- Flutter fake transport responses for search, reverse, route, and nearby.

## Commands

```text
npm run test:unit --prefix server -- tests/unit/location
npm run test --prefix server -- tests/integration/locationRoutes.test.js
npm run server:build
npm run mobile:test
flutter analyze mobile
docker compose config
node scripts/audit-aws-provider-boundaries.mjs
```

## Acceptance Evidence

Backend and static integration proof on 2026-07-16:

- Shared AWS config plus Location controller/service tests: 4 files / 34 tests passed.
- Express Location route integration: 1 file / 3 tests passed.
- Server syntax check: 137 files passed.
- AWS SDK provider-boundary audit passed.
- Docker Compose configuration parsed with `location` declared; only the existing obsolete `version` warning remains.
- Runtime/mobile code, XML permissions, and tests were statically reviewed; `git diff --check` is clean.

Mobile and live-provider proof on 2026-07-16:

- Flutter 3.44.6 / Dart 3.12.2 are installed; `flutter analyze` reports no issues and all 47 mobile tests pass.
- The focused map widget contract proves the compact 18/26/76-percent sheet
  bounds, Vietnamese search/sheet copy, and the typed-search clear action.
- The configured map API key returned the AWS map style descriptor with HTTP 200 and application/json.
- Dedicated Location credentials returned live place search, reverse geocode, and route geometry through the backend boundary.
- Android emulator smoke accepted foreground location, fixed GPS at `10.7769, 106.7009`, rendered the AWS map, and verified the map-first search plus snapping bottom-sheet layout.
- A second visual smoke verified the Vietnamese search/sheet copy, compact empty
  state, opaque persistent navigation, responsive recenter control, and visible
  MapLibre attribution below the search overlay.
- LocalStack declaration is configuration proof only; no LocalStack Location API success is claimed.

Remaining proof:

- The redesigned trust-score marker, restaurant selection/expanded card,
  place-search selection, and fitted route-line interaction still require an
  Android emulator smoke with nearby fixture data before marking the story
  complete.
