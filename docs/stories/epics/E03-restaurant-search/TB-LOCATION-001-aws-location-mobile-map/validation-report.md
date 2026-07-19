# Validation Report

Date: 2026-07-19

## Scope

Validated the `TB-LOCATION-001` Express AWS Location provider boundary,
authenticated route contracts, Flutter API/runtime/map implementation, platform
permission declarations, and LocalStack configuration.

## Commands Run

```text
npm test --prefix server -- tests/unit/config/awsConfig.test.js tests/unit/location --reporter=dot
npm test --prefix server -- tests/integration/locationRoutes.test.js --reporter=verbose
npm test --prefix server -- --run tests/integration/locationRoutes.test.js
npm run server:build
npm test --prefix server -- --reporter=dot
node scripts/audit-aws-provider-boundaries.mjs
docker compose config --quiet
node --check scripts/mobile-run.mjs
npm audit --prefix server
live AWS map style GET (key value redacted)
live AWS SearchPlaceIndexForText diagnostic (credentials redacted)
npm run mobile:test
flutter test test/features/map/map_screen_test.dart
flutter test test/core/api/location_api_test.dart test/core/api/restaurant_api_test.dart test/features/map/map_screen_test.dart
flutter analyze
git -c core.whitespace=cr-at-eol diff --check
```

## Results

| Check | Result | Notes |
| --- | --- | --- |
| Backend unit | pass | 3 focused config/location/middleware files, 23 tests passed, including quota config, state redaction, SDK normalization, and limiter rejection. |
| Backend integration | pass | 1 file, 5 route tests passed for authenticated success, anonymous 401 across all paid operations, validation, safe provider failure, and pre-auth/provider rate limiting. |
| Full server regression | blocked by environment | Latest run reached 459 passed / 23 skipped, but 113 DB integration tests failed because PostgreSQL refused connections on localhost:5432; the prior 2026-07-17 run remains 590 passed / 4 skipped. |
| Backend syntax | pass | `server:build` checked 138 files. |
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
| Review remediation | pass | Paid routes now run the per-IP quota before Cognito/local-account authentication and return 401 without provider execution when unauthenticated. Earlier map-key state exclusion and `RestaurantApi` ownership proof remain unchanged. |

## Main-Branch Merge Remediation

PR #62 was merged locally with `origin/main` on 2026-07-17. The resolution
preserves both the Location dependencies/permissions and the review receipt
image-picker dependencies/permissions introduced on `main`.

| Check | Result | Notes |
| --- | --- | --- |
| Backend unit | pass | 49 files / 463 tests passed after installing the PR lockfile dependencies. |
| Location integration | pass | 1 file / 4 tests passed. |
| Backend syntax | pass | `server:build` checked 139 files. |
| Mobile analyze | pass | No issues found after resolving the combined Flutter plugin set. |
| Mobile unit/widget | pass | All 76 tests passed, including Location and the review/detail work from `main`. |
| PR diff hygiene | pass | `git diff --cached origin/main --check` is clean; this removes the whitespace failure reported by the Static infrastructure validation job. |
| Full backend integration | blocked locally | PostgreSQL was unavailable on `localhost:15432`; DB-backed tests could not run locally. |
| Static infrastructure script | blocked locally | Docker Desktop was not running, so the Terraform-in-container check could not start. The original CI failure was later in the script and was specifically caused by the now-clean PR diff whitespace check. |

## Evidence

- `server/tests/unit/location/`
- `server/tests/unit/middlewares/rateLimit.test.js`
- `server/tests/integration/locationRoutes.test.js`
- `mobile/test/core/api/location_api_test.dart`
- `mobile/test/core/api/restaurant_api_test.dart`
- `mobile/test/features/map/map_screen_test.dart`
- `docs/decisions/0026-aws-location-classic-provider-boundary.md`

## Gaps

- Perform the remaining nearby-marker, selected-card, place-search, and fitted
  route-line interaction smoke with nearby fixture data before moving the story
  to `complete`.
- Replace or complement the in-process Location quota with a distributed/edge
  quota before horizontally scaled production deployment.
