# TB-MOBILE-002 Split Flutter Home Tabs Into Maintainable Files

## Status

implemented

## Lane

normal

## Product Contract

The Flutter home shell must keep the existing bottom-tab behavior while moving
tab-specific UI, mock data, and reusable widgets out of `home_screen.dart` so
future mobile feature work can maintain each screen independently.

## Relevant Product Docs

- `docs/stories/epics/E03-mobile/US-001-mobile-api-integration-contract.md`
- `docs/ARCHITECTURE.md`
- `docs/CONTEXT_RULES.md`

## Acceptance Criteria

- `HomeScreen` owns only shell state, auth handoff, tab selection, and page routing.
- Discover, map, favorites, and profile UI are maintained in separate screen files.
- Home mock data and display models are outside the shell file.
- Existing mobile widget tests still pass without changing user-facing behavior.

## Design Notes

- Commands:
  - `dart format mobile/lib/src/features/home`
  - `flutter test --no-pub`
- Queries:
  - None.
- API:
  - No backend or public API contract changes.
- Tables:
  - No database changes.
- Domain rules:
  - No trust, review, OCR, or auth-token ownership changes.
- UI surfaces:
  - Existing home, map, favorites, profile, and bottom navigation behavior should remain unchanged.

## Validation

When updating durable proof status, use numeric booleans:
`npm run harness -- story update --id <id> --unit 1 --integration 0 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Flutter widget tests pass. |
| Integration | Not required; no API or persistence behavior changes. |
| E2E | Not required for structural refactor. |
| Platform | Existing Flutter test runner compiles the refactored screens. |
| Release | Not required. |

## Harness Delta

No harness policy changes.

## Evidence

- 2026-07-09 refactored `HomeScreen` into a shell plus dedicated
  `pages/`, `widgets/`, `models/`, and `data/` files under
  `mobile/lib/src/features/home/`.
- `flutter analyze` passed with no issues.
- `flutter test --no-pub` passed 15 tests.
- `flutter build apk --debug --no-pub` built
  `build/app/outputs/flutter-apk/app-debug.apk`; Flutter reported Gradle,
  Android Gradle Plugin, and Kotlin deprecation warnings only.
