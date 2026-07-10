# TB-MOBILE-004 Favorites Page UI

## Status

implemented

## Lane

normal

## Product Contract

The Flutter favorites tab presents an empty saved-restaurant state that matches
the visual structure of the other home tabs and gives users clear next actions
without introducing backend favorite persistence.

## Relevant Product Docs

- `docs/product/restaurant-discovery.md`
- `docs/stories/epics/E03-mobile/TB-MOBILE-002-home-tab-refactor.md`
- `docs/ARCHITECTURE.md`
- `docs/CONTEXT_RULES.md`

## Acceptance Criteria

- Favorites remains a dedicated home tab page under the existing home shell.
- The empty state uses TrustBite home typography, colors, spacing, and card
  treatment instead of a standalone placeholder card.
- The page includes discovery-oriented suggestions using existing mock
  restaurant data only.
- No authentication, API, provider, database, or real favorite-state behavior is
  introduced by this UI slice.
- Flutter widget tests cover the favorites tab entry point and visible content.

## Design Notes

- Commands:
  - `dart format mobile/lib/src/features/home/pages/favorites_page.dart mobile/test/widget_test.dart`
  - `npm run mobile:test`
- Queries:
  - `npm run harness -- query matrix`
- API:
  - No API changes.
- Tables:
  - No database changes.
- Domain rules:
  - No trust, review, OCR, GPS, auth, or favorite-persistence rule changes.
- UI surfaces:
  - `mobile/lib/src/features/home/pages/favorites_page.dart`
  - `mobile/test/widget_test.dart`

## Validation

When updating durable proof status, use numeric booleans:
`npm run harness -- story update --id <id> --unit 1 --integration 0 --e2e 0 --platform 1`

| Layer | Expected proof |
| --- | --- |
| Unit | Flutter widget test proves the Favorites tab renders the empty state and suggestions. |
| Integration | Not required; no API or persistence behavior changes. |
| E2E | Not required for this UI-only slice. |
| Platform | `npm run mobile:test` compiles the affected Flutter widget tree. |
| Release | Not required. |

## Harness Delta

No harness policy changes.

## Evidence

- 2026-07-09 redesigned the Favorites tab with a richer empty state, filter
  chips, suggestion cards, and a save hint panel using existing home tokens and
  mock restaurant data.
- 2026-07-09 reverted the ornate Favorites header to a simple text-only title
  and subtitle with no header icon, matching the requested lighter treatment.
- `dart format mobile/lib/src/features/home/pages/favorites_page.dart mobile/test/widget_test.dart`
  passed.
- `cd mobile; flutter analyze` passed with no issues.
- `npm run mobile:test` passed 22 Flutter tests.
- `node scripts/harness.mjs story verify TB-MOBILE-004` passed with the
  story verify command `npm run mobile:test`.
