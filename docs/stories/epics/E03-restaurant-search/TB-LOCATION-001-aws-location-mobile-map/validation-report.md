# Validation Report

Date: 2026-07-16

## Scope

Validated the `TB-LOCATION-001` Express AWS Location provider boundary,
public route contracts, Flutter API/runtime/map implementation, platform
permission declarations, and LocalStack configuration.

## Commands Run

```text
npm test --prefix server -- tests/unit/config/awsConfig.test.js tests/unit/location --reporter=dot
npm test --prefix server -- tests/integration/locationRoutes.test.js --reporter=verbose
npm run server:build
node scripts/audit-aws-provider-boundaries.mjs
docker compose config --quiet
node --check scripts/mobile-run.mjs
npm audit --prefix server
live AWS map style GET (key value redacted)
live AWS SearchPlaceIndexForText diagnostic (credentials redacted)
npm run mobile:test
flutter test test/features/map/map_screen_test.dart
flutter analyze
git -c core.whitespace=cr-at-eol diff --check
```

## Results

| Check | Result | Notes |
| --- | --- | --- |
| Backend unit | pass | 4 files, 34 tests passed, including shared AWS config, strict controller validation, SDK commands, normalization, and safe provider errors. |
| Backend integration | pass | 1 file, 3 route tests passed for mounting, validation envelope, and safe provider failure. |
| Backend syntax | pass | `server:build` checked 137 files. |
| Provider boundary | pass | AWS SDK import/client audit passed. |
| Dependency audit | pass | npm audit found 0 vulnerabilities. |
| Docker config | pass with warning | Compose parses with `location` declared; existing top-level `version` key is obsolete. |
| Mobile analyze | pass | Flutter 3.44.6 / Dart 3.12.2 reported no issues. |
| Mobile unit/widget | pass | All 47 Flutter tests passed, including the 12/16/82-percent map sheet, collapsed-content visibility, and typed-search clear-action contract. |
| Map-first UI | pass | Emulator smoke confirmed Vietnamese search/sheet copy, the compact empty state, visible attribution, responsive recenter control, and opaque navigation without sheet overlap. |
| Live map style | pass | The configured map API key returned HTTP 200 with an application/json style descriptor. |
| Credential isolation | pass | Location now prefers dedicated `AWS_LOCATION_*` credentials, including an optional session token, and falls back to shared/default-role credentials; focused config/service proof passed 14/14 tests. |
| Live backend AWS | pass | Dedicated same-account Location credentials successfully returned place-search results, a reverse-geocode place, and a walking route with geometry; credential values and provider payloads were not logged. |
| Android build/install | pass | Debug APK built and installed on the `sdk gphone16k x86_64` Android emulator (`emulator-5554`); the app launched successfully. |
| E2E/device | partial | The Android emulator accepted the foreground-location permission and a Quận 1 GPS fix (`10.7769, 106.7009`). The AWS map rendered and centered on Ho Chi Minh City. The redesigned trust-score marker, selected card, place-search, and fitted route-line interaction smoke remains open because the current viewport returned no nearby restaurants. |
| Diff hygiene | pass | The CRLF-aware diff check is clean; Git only reports line-ending conversion warnings. |

## Evidence

- `server/tests/unit/location/`
- `server/tests/integration/locationRoutes.test.js`
- `mobile/test/core/api/location_api_test.dart`
- `mobile/test/features/map/map_screen_test.dart`
- `docs/decisions/0026-aws-location-classic-provider-boundary.md`

## Gaps

- Perform the remaining nearby-marker, selected-card, place-search, and fitted
  route-line interaction smoke with nearby fixture data before moving the story
  to `complete`.
- Public place/route endpoints should receive an application-level cost/rate
  limit before production exposure.
