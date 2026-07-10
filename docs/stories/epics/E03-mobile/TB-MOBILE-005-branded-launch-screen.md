# TB-MOBILE-005 Branded Launch Screen

## Status

implemented

## Lane

normal

## Product Contract

The mobile app startup experience should use TrustBite's home-screen visual
language instead of a plain white native splash with a small app icon.

## Relevant Product Docs

- `docs/stories/epics/E03-mobile/TB-MOBILE-002-home-tab-refactor.md`
- `docs/stories/epics/E03-mobile/TB-MOBILE-004-favorites-page-ui.md`
- `docs/ARCHITECTURE.md`
- `docs/CONTEXT_RULES.md`

## Acceptance Criteria

- Cold start splash uses the TrustBite orange brand, home background treatment,
  and app icon artwork.
- Flutter shows a short branded startup screen before handing off to the
  existing home shell.
- Native Android and iOS launch surfaces no longer render as a plain white
  screen with only a small centered icon.
- No authentication, API, provider, database, or trust-score behavior changes.
- Flutter tests cover the branded launch handoff.

## Design Notes

- Commands:
  - `dart format mobile/lib/src/features/launch/brand_launch_screen.dart mobile/lib/src/app.dart mobile/test/widget_test.dart`
  - `npm run mobile:test`
  - `flutter build apk --debug --no-pub`
- Queries:
  - `npm run harness -- query matrix`
- API:
  - No API changes.
- Tables:
  - No database changes.
- Domain rules:
  - No review, OCR, GPS, auth-token, or trust-score rule changes.
- UI surfaces:
  - `mobile/lib/src/features/launch/brand_launch_screen.dart`
  - `mobile/lib/src/app.dart`
  - Android launch background resources
  - iOS LaunchScreen storyboard/assets

## Validation

When updating durable proof status, use numeric booleans:
`npm run harness -- story update --id TB-MOBILE-005 --unit 1 --integration 0 --e2e 0 --platform 1`

| Layer | Expected proof |
| --- | --- |
| Unit | Flutter widget test proves the launch screen renders and hands off. |
| Integration | Not required; no API or persistence behavior changes. |
| E2E | Not required for this UI-only slice. |
| Platform | Debug APK build packages Android launch resources. |
| Release | Not required. |

## Harness Delta

No harness policy changes.

## Evidence

- 2026-07-10 added a Flutter `BrandLaunchScreen` that uses the home background,
  TrustBite orange accent, app icon artwork, trust-signal chips, and a short
  handoff into the existing home shell.
- 2026-07-10 replaced plain native launch surfaces with a cream TrustBite
  background and centered launch lockup for Android and iOS.
- `cd mobile; flutter analyze` passed with no issues.
- `npm run mobile:test` passed 23 Flutter tests.
- `cd mobile; flutter build apk --debug --no-pub` built
  `build/app/outputs/flutter-apk/app-debug.apk`; Flutter reported Gradle,
  Android Gradle Plugin, and Kotlin deprecation warnings only.
- `node scripts/harness.mjs story verify TB-MOBILE-005` passed.
