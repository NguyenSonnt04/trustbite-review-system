# Validation

## Proof Strategy

Use DB-backed integration tests as the primary proof because the story depends
on SQL filters, public visibility rules, rating aggregation, owner claim
projection, and public DTO shaping.

## Acceptance Criteria

- `GET /api/v1/restaurants/:restaurantId` returns `404 RESTAURANT_NOT_FOUND`
  for unknown, non-active, or soft-deleted restaurants.
- Detail response includes public profile fields, `ratingBreakdown`, and latest
  `ownerClaimStatus` when present.
- Rating breakdown counts only `VERIFIED` and `REFERENCE_ONLY` public reviews.
- `GET /api/v1/restaurants/:restaurantId/reviews` supports
  `status=VERIFIED|REFERENCE_ONLY|ALL`, `page`, and `pageSize`.
- Public review listing excludes `HIDDEN`, `DELETED`, rejected, private, and
  otherwise non-public reviews.
- Public review listing omits reviewer `userId`.
- Invalid UUID, invalid status, and invalid pagination values return the
  standard error envelope.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Controller UUID/status/pagination parsing and public response DTO rules |
| Integration | Postgres fixtures for ACTIVE gate, soft-delete gate, rating breakdown, latest claim status, review status filters, public visibility, and omitted `userId` |
| E2E | Not required for backend-only closeout |
| Platform | `npm run db:migrate` against local Postgres/PostGIS |
| Build | `npm run server:build` |

## Commands

Do not attach a Harness `verify_command` until the integration command exists
and proves the behavior above.

Expected closeout command shape:

```text
npm run db:migrate
npm run test:integration --prefix server -- <focused restaurant detail/review integration tests>
npm run server:build
```

## Acceptance Evidence

Pending. Detail/review closeout still lacks durable local database proof.
