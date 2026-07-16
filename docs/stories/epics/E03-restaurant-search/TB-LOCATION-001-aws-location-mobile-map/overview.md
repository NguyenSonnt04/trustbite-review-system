# TB-LOCATION-001: AWS Location Mobile Map

## Status

in_progress

## Lane

high-risk

## Current Behavior

The Flutter map tab is a static mockup. The Express backend has no Amazon
Location routes or SDK boundary. Restaurant viewport lookup already exists at
`GET /api/v1/restaurants/nearby` and accepts southwest/northeast bounds.

## Target Behavior

Users can grant foreground location access, view the configured TrustBite map,
see active restaurants in the visible viewport, search Esri-backed places, and
request a route from their current position to a selected restaurant. AWS
credentials remain server-only; the map API key is injected into the mobile
build and restricted at the AWS resource boundary.

## Affected Users

- Mobile users discovering restaurants.
- Developers configuring local or real AWS environments.

## Affected Product Docs

- `docs/product/provider-integrations.md`
- `docs/product/restaurant-discovery.md`
- `docs/ARCHITECTURE.md`
- `docs/stories/epics/E03-mobile/US-001-mobile-api-integration-contract.md`

## Acceptance Criteria

- Location resource names and endpoint/region are read from server environment
  configuration with no source credential or API-key literal.
- Express exposes validated public read-only search, reverse-geocode, and route
  endpoints under `/api/v1/location`.
- Controllers validate exact numeric coordinate strings, coordinate ranges,
  search length, and supported travel modes before services run.
- Provider payloads are normalized so controllers and Flutter do not depend on
  Esri/AWS response internals.
- Mobile loads the AWS map style only when a runtime API key is present and
  shows a safe configuration error otherwise.
- The mobile discovery view is map-first: the map fills the available canvas,
  search floats above it, and a draggable bottom sheet owns GPS state, route
  summary, empty/error guidance, and nearby restaurant results.
- The map discovery UI uses Vietnamese copy, keeps its default sheet compact,
  exposes a clear search action, and keeps map attribution visible above
  persistent navigation.
- Nearby markers expose trust scores, selected restaurants receive a distinct
  marker/card state, and a successful route fits its geometry in the remaining
  map viewport.
- Mobile requests only foreground location, handles denied/disabled services,
  loads `/restaurants/nearby` with viewport bounds, searches locations, and
  renders the selected route geometry.
- Android and iOS foreground location usage strings are present.
- LocalStack declares `location`, but validation distinguishes declaration
  from actual emulator support.

## Non-Goals

- Turn-by-turn navigation or background tracking.
- Mobile-side trust or distance decisions.
- New tables, columns, indexes, or restaurant mutations.
