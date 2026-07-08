# Design

## Existing Architecture

Restaurant routes are mounted under `/api/v1/restaurants` in
`server/src/routes/restaurant.js`. Controllers parse HTTP input and call
service functions in `server/src/services/restaurantService.js`. SQL uses the
PostgreSQL pool exported from `server/src/config/db.js`.

The current public list query already applies:

```sql
r.status = 'ACTIVE' AND r.is_deleted = FALSE
```

Phase 3 keeps that public gate.

## Route Shape

Add the new map endpoint before dynamic ID routes:

```text
GET /api/v1/restaurants
GET /api/v1/restaurants/nearby
GET /api/v1/restaurants/:restaurantId/reviews
GET /api/v1/restaurants/:restaurantId
```

This order prevents `nearby` from being parsed as `restaurantId`.

## Query Parsing

Controller parsing must reject malformed numeric strings rather than relying on
JavaScript partial parsing. Validation errors return HTTP `422` with
`VALIDATION_ERROR`.

Rules:

- `lat` and `lng` must appear together.
- `radiusMeters` cannot appear without `lat/lng`.
- `distanceAsc` cannot be used without `lat/lng`.
- `pageSize` maximum is `100` for list and `250` for nearby.
- Bounds lookup rejects empty, inverted, or antimeridian-crossing rectangles in
  Phase 3, including `northEastLat <= southWestLat` and
  `northEastLng <= southWestLng`.

## SQL Design

Use parameterized SQL only.

Radius search:

```sql
ST_DWithin(
  r.geo,
  ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography,
  $radiusMeters
)
```

Distance projection:

```sql
ST_Distance(
  r.geo,
  ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography
) AS distance_meters
```

Map bounds may use a geometry envelope against `r.geo::geometry`, while still
keeping the active/non-deleted public condition.

## Response Mapping

Reuse the existing public restaurant mapper and add `distanceMeters` only when
SQL returns `distance_meters`. Keep response field names camelCase.

## Schema Impact

No schema change is planned for the first implementation pass. If integration
or performance tests show the existing `geo` indexes cannot support the
contract, create a separate high-risk schema story before changing migrations.
