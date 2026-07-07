# Design

## Existing Architecture

Restaurant detail and public review listing are mounted under
`/api/v1/restaurants` in `server/src/routes/restaurant.js`. Controllers parse
HTTP input and call service functions in
`server/src/services/restaurantService.js`. SQL uses the PostgreSQL pool
exported from `server/src/config/db.js`.

## Current Code Baseline

- `GET /api/v1/restaurants/:restaurantId` is implemented through
  `restaurantService.getRestaurantDetail`.
- `GET /api/v1/restaurants/:restaurantId/reviews` is implemented through
  `listPublicReviewsByRestaurant`.
- Routes are wired in `server/src/routes/restaurant.js`.
- Unit proof exists for controller boundary parsing and review service
  filtering.
- DB-backed proof remains pending.

## Interface Contract

- `GET /api/v1/restaurants/:restaurantId` returns `404 RESTAURANT_NOT_FOUND`
  for unknown, non-active, or soft-deleted restaurants.
- Detail response includes public profile fields, `ratingBreakdown`, and latest
  `ownerClaimStatus` when present.
- `GET /api/v1/restaurants/:restaurantId/reviews` supports
  `status=VERIFIED|REFERENCE_ONLY|ALL`, `page`, and `pageSize`.
- Public responses omit reviewer `userId`.
- Invalid UUID, invalid status, and invalid pagination values return the
  standard error envelope.

## Data Model

- Use existing restaurant, review, and owner-claim tables from
  `server/migrations/`.
- Public detail gates on `restaurants.status = 'ACTIVE'` and
  `restaurants.is_deleted = FALSE`.
- Public review listing and rating breakdown count only reviews with
  `status IN ('VERIFIED', 'REFERENCE_ONLY')` and
  `public_visibility = 'PUBLIC'`.
- Do not add fields, indexes, tables, or constraints inside this story without
  a separate high-risk schema story.

## Observability

No new audit/logging contract is introduced by this public read story. If
read-side analytics or audit records become required, pause for a separate
observability story.

## Alternatives Considered

1. Keep the existing single story file. Rejected because high-risk stories must
   expose separate overview, execution plan, design, and validation surfaces.
