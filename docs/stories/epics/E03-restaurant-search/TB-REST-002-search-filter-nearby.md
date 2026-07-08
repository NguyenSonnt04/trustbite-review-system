# TB-REST-002 Restaurant Search, Filters, And Nearby Lookup

## Status

implemented

## Lane

normal

## Product Contract

Public restaurant discovery lists only active, non-deleted restaurants and lets
users search by restaurant name. For Vietnam-market usage, name search must be
tolerant of Vietnamese diacritics so a keyword such as `bun cha huong lien`
matches `Bún Chả Hương Liên`.

## Relevant Product Docs

- `docs/ARCHITECTURE.md` - Restaurant and verification domain boundaries.
- `trustbite-docs/04_Software_Engineering/API_Specification.md` - restaurant
  listing API shape.
- `trustbite-docs/02_Business_Analysis/Business_Rules.md` - public restaurant
  visibility rules.

## Acceptance Criteria

- `GET /api/v1/restaurants` returns only `ACTIVE` restaurants where
  `is_deleted = FALSE`.
- `keyword` searches restaurant names without requiring exact Vietnamese
  accents.
- Search also handles names stored with decomposed Unicode combining marks.
- Search keeps the existing exact/partial name behavior for accented input.
- Pagination remains strict and bounded.
- The service does not require a PostgreSQL `unaccent` extension to be present.

## Design Notes

- Route: `server/src/routes/restaurant.js`.
- Controller: `server/src/controllers/restaurant.js`.
- Service: `server/src/services/restaurantService.js`.
- Tables: `restaurants`, `restaurant_category_map`.
- Search uses `ILIKE` for the raw keyword and nested `translate(lower(r.name), ...)`
  calls for accent-insensitive matching without requiring a database extension.

## Validation

When updating durable proof status, use numeric booleans:
`npm run harness -- story update --id TB-REST-002 --unit 1 --integration 1 --e2e 0 --platform 1`.

| Layer | Expected proof |
| --- | --- |
| Unit | Controller validation for keyword, pagination, and public status. |
| Integration | Database-backed public list/search regression with Vietnamese names. |
| E2E | Not in scope for backend closeout. |
| Platform | `npm run server:build` syntax/platform smoke. |
| Release | Full server suite before release. |

## Harness Delta

This story file was added because the Harness durable matrix already tracks
`TB-REST-002`, but the repo did not have a corresponding markdown packet.

## Evidence

2026-07-08 Vietnam-market follow-up:

- Added `server/tests/integration/restaurantSearch.integration.test.js`.
- Red proof: `bun cha huong lien` did not match `Bún Chả Hương Liên`.
- Review follow-up proof: `pho ga ky dong` matches a decomposed-Unicode
  stored name for `Phở Gà Kỳ Đồng`.
- Green proof: `npm run test:integration --prefix server -- tests/integration/restaurantSearch.integration.test.js`
  passed with 8 integration files passed, 1 skipped, 63 tests passed, 2 skipped.
