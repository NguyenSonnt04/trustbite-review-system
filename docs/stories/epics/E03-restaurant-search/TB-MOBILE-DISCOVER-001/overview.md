# TB-MOBILE-DISCOVER-001: Load Real Restaurants On Mobile Discover

## Current Behavior

The mobile Discover page renders the nearby restaurant cards from
`home_mock_data.dart`, including hardcoded names, scores, distances, status
labels, and remote image URLs. The public restaurant API does not expose the
primary image selected by restaurant management.

## Target Behavior

- Mobile Discover loads restaurant summaries from `GET /api/v1/restaurants`.
- Public restaurant summaries expose a nullable `primaryImageUrl`.
- Stored private S3 references are resolved to signed URLs by the backend and
  are never sent directly to mobile.
- The nearby card area has loading, empty, failure, retry, missing-image, and
  missing-distance behavior.
- Tapping a backend restaurant card loads `GET /api/v1/restaurants/:id` and
  opens a mobile detail page with retryable failure handling.
- Publication status is not presented as operating-hours state.

## Affected Users

- Mobile guests and signed-in reviewers browsing restaurant cards.
- Administrators whose selected primary restaurant image becomes public.

## Affected Product Docs

- `docs/product/restaurant-discovery.md`
- `docs/decisions/0025-restaurant-image-storage-lifecycle.md`

## Non-Goals

- Device location permissions or GPS acquisition.
- Recently viewed history, favorites, trusted picks, or latest-review feeds.
- Schema changes.
