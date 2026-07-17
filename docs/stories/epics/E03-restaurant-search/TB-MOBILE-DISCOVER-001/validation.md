# Validation

## Proof Strategy

Prove the public API exposes only resolved primary image URLs, then prove
Flutter parses and renders real summaries without assuming optional image or
distance fields.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Mobile list/detail parsing, field formatting, malformed response rejection |
| Integration | Public list returns primary URL or null without exposing storage field names |
| E2E | Card tap opens the selected detail; detail failure retries successfully |
| Platform | Flutter analyze, full widget tests, Android debug APK |
| Performance | Existing page size cap of ten cards |
| Logs/Audit | No new mutation or audit behavior |

## Fixtures

- Active restaurant with branchless primary and non-primary HTTPS image rows.
- Active restaurant with no primary image.
- Mobile API envelopes with complete, missing optional, malformed, empty, and
  failed results.
- Detail response with rating breakdown plus a fail-once retry fixture.

## Commands

```text
npm run db:migrate
npx vitest run --no-file-parallelism tests/integration/restaurantSearch.integration.test.js
npm run server:test
npm run server:build
npm run mobile:test
flutter analyze
flutter build apk --debug --no-pub
git diff --check
```

## Acceptance Evidence

Verified on 2026-07-15:

- Database migrations were current, with 0 new migrations applied.
- Focused restaurant search integration proof passed 17 tests.
- Full server suite passed 546 tests with 4 provider tests skipped.
- Server syntax check passed for 133 files.
- Full mobile suite passed 46 tests, including card-to-detail navigation and
  detail retry behavior.
- Flutter analysis reported no issues.
- Android debug APK built successfully.
- Focused backend restaurant-detail integration passed 4 tests.
- A live local API smoke returned real PostgreSQL restaurant rows and a
  short-lived signed `primaryImageUrl` for an existing primary image.
