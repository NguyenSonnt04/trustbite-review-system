# TB-MOBILE-003 Add Mock Notifications Page

## Status

implemented

## Lane

normal

## Product Contract

The Flutter home notification button opens a dedicated notifications page
populated from local mock data. The mock page must not call or imply a live
notification API.

## Relevant Product Docs

- `docs/stories/epics/E03-mobile/US-001-mobile-api-integration-contract.md`
- `docs/ARCHITECTURE.md`

## Acceptance Criteria

- Tapping the notification bell opens a dedicated page.
- The page renders three local mock notifications and the unread count.
- Back navigation returns to the home page.
- No backend route, persistence, push provider, or auth behavior is added.

## Design Notes

- Commands:
  - `dart format mobile/lib/src/features/home mobile/test/widget_test.dart`
  - `npm run mobile:test`
- Queries: None.
- API: None; notification content is local mock data.
- Tables: None.
- Domain rules: None.
- UI surfaces: Home header notification button and notifications page.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | Flutter widget test opens the page, checks all mock rows, and returns home. |
| Integration | Not required; no API or persistence behavior. |
| E2E | Not required for the local mock flow. |
| Platform | Flutter test runner compiles the page and navigation. |
| Release | Not required. |

## Harness Delta

No Harness policy changes.

## Evidence

- Dedicated `NotificationsPage` added under `mobile/lib/src/features/home/pages/`.
- Mock notification data remains under `mobile/lib/src/features/home/data/`.
- `flutter analyze --no-pub` passed with no issues.
- `npm run mobile:test` passed 16 tests, including open, list-content, and back
  navigation proof for the mock notifications page.
- `npm run harness -- story verify TB-MOBILE-003` passed.
- 2026-07-09 visual polish replaced orange icon tiles and card borders with
  neutral outlined icons, a 44px back control, and a dark unread-count pill.
  The debug APK was installed and inspected on `emulator-5554`; the page
  rendered without clipping, overlap, or overflow.
- The 44px back control remains borderless and transparent; only its tap target
  and ripple affordance remain visible.
- The home header no longer renders the standalone `T` brand tile; location and
  trust context align directly to the content edge while the notification
  control remains on the right.
- Final branch validation: `flutter analyze --no-pub` passed, `npm run
  mobile:test` passed 16 tests, `flutter build apk --debug --no-pub` built the
  debug APK, `npm run server:build` passed, migrations were current, and
  `npm run server:test` passed 310 tests with 2 skipped.
