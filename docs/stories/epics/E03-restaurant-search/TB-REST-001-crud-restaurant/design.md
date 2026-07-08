# Design

## Existing Architecture

Restaurant routes are mounted under `/api/v1/restaurants` in
`server/src/routes/restaurant.js`. Controllers parse HTTP input and call
service functions in `server/src/services/restaurantService.js`. SQL uses the
PostgreSQL pool exported from `server/src/config/db.js`.

## Current Code Baseline

- Routes: `server/src/routes/restaurant.js`
- Controller: `server/src/controllers/restaurant.js`
- Service: `server/src/services/restaurantService.js`
- Model: `server/src/models/restaurant/restaurant.js`
- Tables: `restaurants`, `restaurant_category_map`
- Mutating routes currently use `authMiddleware`.
- Public list currently forces `status = 'ACTIVE'` and supports only
  `keyword`, `page`, and `pageSize`.

## Interface Contract

- `POST /api/v1/restaurants` creates a restaurant with name, optional profile
  fields, optional coordinates, and optional category mappings.
- `PATCH /api/v1/restaurants/:restaurantId` updates only accepted fields and
  keeps geospatial columns synchronized when coordinates change or are cleared.
- `DELETE /api/v1/restaurants/:restaurantId` soft-deletes by setting
  `is_deleted = TRUE` and `deleted_at`.
- Mutating routes require authenticated identity before service logic runs.
- Error responses follow the standard `{ error: { code, message, requestId } }`
  envelope.

## Data Model

- Use existing `restaurants` columns, including `latitude`, `longitude`,
  `geo`, `status`, `is_deleted`, and `deleted_at`.
- Use existing `restaurant_category_map` for category relationships.
- Do not add fields, indexes, tables, enum/check values, or constraints inside
  this story without a separate high-risk schema story.
- Restaurant writes must run inside transactions when multiple tables or
  generated values are updated.

## Business Rules

- New restaurant writes keep `geo` synchronized with `latitude` and
  `longitude`.
- Slug generation is unique or retries safely on collision.
- Status updates accept only `DRAFT`, `ACTIVE`, `SUSPENDED`, or `CLOSED`.
- Public reads never return soft-deleted restaurants.
- Production authorization for who may create/update/delete restaurants is an
  open decision before this story can be marked implemented.

## Observability

No new audit/logging contract is introduced by this story. If restaurant
mutation audit records become required, pause for a high-risk audit/security
story and decision.

## Alternatives Considered

1. Keep the existing single story file. Rejected because high-risk stories must
   expose separate overview, execution plan, design, and validation surfaces.
