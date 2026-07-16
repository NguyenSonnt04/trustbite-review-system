# Design

## Domain Model

Location search and route calculation are stateless provider queries. TrustBite
normalizes provider places to `label`, `latitude`, `longitude`, optional address
components, and categories. Route geometry remains ordered `[longitude,
latitude]` pairs, matching GeoJSON/MapLibre coordinate order.

No GPS result from this UI changes verification or trust state.

## Application Flow

```text
Flutter map -> TrustBiteApiClient -> Express location controller
            -> locationService -> AWS Location SDK

Flutter map -> RestaurantApi -> TrustBiteApiClient -> restaurants/nearby
```

Provider clients are created only in `server/src/services/` from configuration
in `server/src/config/`. Controllers validate HTTP input and remain
provider-neutral.
`LocationService` copies only provider resource names into service state; the
mobile map key/name are not part of the service instance configuration.


## Interface Contract

All routes are public read-only routes.
The three paid Location routes share one per-IP fixed-window quota. Exceeding
the configured quota returns `429 LOCATION_RATE_LIMITED` before validation or
provider execution.


### `GET /api/v1/location/search`

Query:

- `q`: required trimmed string, 1-200 characters.
- `lat` and `lng`: optional pair used as a search bias; both must be present.

Success `200`:

```json
{"items":[{"label":"...","latitude":10.0,"longitude":106.0,"country":"VNM","categories":[]}]}
```

### `GET /api/v1/location/reverse-geocode`

Query: required `lat` and `lng`.

Success `200`:

```json
{"place":{"label":"...","latitude":10.0,"longitude":106.0}}
```

`place` is `null` when the provider returns no match.

### `GET /api/v1/location/route`

Query:

- required `originLat`, `originLng`, `destLat`, and `destLng`.
- optional `mode`: `car`, `truck`, or `walking`;
  defaults to `car`.

Success `200`:

```json
{
  "route": {
    "distanceMeters": 1200,
    "durationSeconds": 420,
    "geometry": [[106.0, 10.0], [106.01, 10.01]],
    "legs": []
  }
}
```

Malformed boundary input returns `422 VALIDATION_ERROR`. Missing Location
resource configuration or provider failures use structured application errors
and never return credentials or raw provider payloads.

## Data Model

No schema change. The existing `restaurants.latitude`,
`restaurants.longitude`, and `restaurants.geo` contract remains authoritative.
Nearby restaurants continue to come from the existing PostGIS viewport API.

## UI / Platform Impact

- Local Location credentials may be isolated with
  `AWS_LOCATION_ACCESS_KEY_ID`, `AWS_LOCATION_SECRET_ACCESS_KEY`, and optional
  `AWS_LOCATION_SESSION_TOKEN`. When omitted, the backend falls back to the
  shared AWS credential/default role chain so deployed workloads can use an
  execution role without long-lived Location keys.
- `AWS_LOCATION_MAP_API_KEY` is a mobile runtime value, injected through
  `--dart-define`; it is not committed.
- Android requests coarse/fine location and Internet access.
- iOS declares only when-in-use location access.
- The map presents loading, permission/configuration, empty, and provider-error
  states without blocking the rest of the app.
- The map is the primary surface. Search remains pinned over the top edge while
  a draggable, snapping bottom sheet moves between compact, browse, and
  expanded states behind the persistent TrustBite navigation.
- The sheet uses a neutral drag handle and keeps restaurant actions, route
  summaries, and recovery controls in one scrollable interaction layer.
- The compact sheet opens at 16 percent of the map canvas with a 12-percent
  minimum. Its content becomes visible after expansion, preventing clipped
  title/empty-state copy behind navigation. Restaurant selection expands the
  sheet to 50 percent, and users may expand it to 82 percent.
- Restaurant annotations show normalized trust scores inside TrustBite-orange
  markers. Selection changes the marker and card treatment before exposing the
  route action; route geometry is fitted with top and bottom UI padding.
- MapLibre attribution and logo controls are positioned below the floating
  search instead of underneath the sheet or persistent navigation.

## Observability

Provider errors are mapped to stable HTTP errors. Search text, API keys,
credentials, and exact user coordinates must not be added to logs by this
slice.

## Alternatives Considered

1. Call place and route APIs directly from Flutter. Rejected because it moves
   IAM/provider behavior and response coupling into the client.
2. Query nearby restaurants by a fabricated radius endpoint. Rejected because
   the accepted API uses visible viewport bounds.
3. Use the newer AWS Routes/Places APIs immediately. Deferred because the
   provisioned Place Index and Route Calculator are classic resources and the
   requested IAM contract names classic actions.
