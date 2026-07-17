# Design

## Domain Model

`HomeRestaurant` carries the backend restaurant ID and nullable image and
distance values. Trust score and verified-review count are formatted for the
existing card without inventing an operating-hours or featured value.

## Application Flow

1. `HomeScreen` creates one `RestaurantDiscoveryService` from `appApiClient`.
2. `DiscoverPage` requests the first ten restaurants sorted by trust score.
3. The service validates the page envelope and required restaurant fields.
4. The nearby section renders loading, cards, empty, or retryable failure UI.
5. Card taps push `RestaurantDetailPage`, which requests the selected backend
   ID and renders detail loading, success, failure, and retry states.

## Interface Contract

`GET /api/v1/restaurants?sort=trustScoreDesc&pageSize=10` keeps the existing
page envelope. Each item additionally includes:

```json
{
  "primaryImageUrl": "https://signed-or-legacy-public-url.example/image.jpg"
}
```

`primaryImageUrl` is nullable. Stable `s3://` references and internal
`image_url` column names are not public fields.

`GET /api/v1/restaurants/:restaurantId` supplies the detail page with public
profile fields and `ratingBreakdown`. The mobile client validates the required
ID, name, and rating-breakdown object before rendering.

## Data Model

No migration is required. The public query reads the newest branchless row
where `restaurant_images.is_primary = TRUE`.

## UI / Platform Impact

- Flutter uses the existing API client and network-image widget.
- Missing or failed images render the existing neutral fallback.
- Android main manifest declares internet access for non-debug builds.
- The first slice does not request device location, so distance is displayed
  only when the backend response includes `distanceMeters`.

## Observability

Existing API error handling is reused. No new logs or audit records are needed
for this public read.

## Alternatives Considered

Fetching image rows directly from mobile was rejected because it would expose
storage references and bypass the signed-delivery boundary.
