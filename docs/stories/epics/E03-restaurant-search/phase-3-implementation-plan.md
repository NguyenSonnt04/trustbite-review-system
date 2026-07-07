# Phase 3 Restaurant Discovery Implementation Plan

## Status

in_progress

## Lane

high-risk

## Goal

Prepare the backend restaurant discovery slice so client/mobile UI can build on
real API behavior instead of mock data. This plan intentionally excludes Phase
3 UI tasks until the API contracts and database proof are durable.

## Baseline Audit

Harness and codebase review show:

- `GET /api/v1/restaurants` exists but only supports `keyword`, `page`, and
  `pageSize`.
- `GET /api/v1/restaurants/nearby` is missing.
- `GET /api/v1/restaurants/:restaurantId` and
  `GET /api/v1/restaurants/:restaurantId/reviews` exist and have unit proof,
  but still need DB-backed integration proof.
- CRUD routes exist, but the story packet has no durable Harness verification
  command and no local transaction rollback proof.
- The older `trustbite-docs` API spec mentions restaurant location search,
  nearby bounds, detail, and verified/reference reviews, but the local product
  contract was missing until `docs/product/restaurant-discovery.md`.

## Implementation Order

### 0. Documentation and Harness alignment

- Product contract: `docs/product/restaurant-discovery.md`.
- Story plan: this file.
- Story packets:
  - `TB-REST-001` for CRUD closeout.
  - `TB-REST-002` for search/filter/nearby.
  - `REST-US-003` for detail plus verified/reference review closeout.
- Harness matrix must include all selected backend Phase 3 stories before
  implementation starts.

### 1. Close out CRUD proof (`TB-REST-001`)

Status: implemented on 2026-07-08.

Implement only fixes exposed by tests. Expected work:

- Add DB-backed tests for create, update, soft-delete, slug collision retry,
  category mapping, and `geo` synchronization.
- Confirm mutating routes require Cognito-backed authenticated identity.
- Record the open production authorization decision if CRUD mutations remain
  broader than admin/owner scope.
- Add a real Harness `verify_command` only after the tests exist.

### 2. Implement search/filter/nearby (`TB-REST-002`)

Status: implemented on 2026-07-08.

Use TDD because this changes public API behavior, validation, SQL filtering,
and location logic.

Red tests first:

- Reject malformed `lat`, `lng`, `radiusMeters`, `minTrustScore`, `sort`,
  `page`, and `pageSize`.
- Reject incomplete location pairs and `distanceAsc` without coordinates.
- Return only active, non-deleted restaurants.
- Filter by radius using PostGIS.
- Filter by minimum trust score.
- Sort by name, trust score descending, and distance ascending.
- Serve `/restaurants/nearby` without being shadowed by `/:restaurantId`.

Green/refactor:

- Add parsing helpers in the controller only when existing helpers are
  insufficient.
- Extend `restaurantService.listRestaurants`.
- Add a dedicated `listNearbyRestaurants` service function.
- Keep SQL parameterized and keep response DTOs camelCase.

### 3. Close out detail and public reviews (`REST-US-003`)

Status: implemented on 2026-07-08.

Expected work:

- Add integration tests for non-active/soft-deleted restaurant 404 behavior.
- Add integration tests for review status filter, public visibility filter, and
  omitted public `userId`.
- Add rating-breakdown proof for `VERIFIED` and `REFERENCE_ONLY` only.
- Add a real Harness `verify_command` after the integration command exists.

### 4. Harness closeout

- Run `npm run harness -- query matrix`.
- Run each story verify command after it is added.
- Record trace evidence that includes commands, pass/fail state, and any local
  infrastructure blockers.
- Keep `docs/TEST_MATRIX.md` aligned with the Harness database.

## Stop Conditions

Stop and document a blocker instead of claiming completion when:

- PostgreSQL/PostGIS cannot run locally.
- The DB migration has not been applied before DB-backed proof.
- A story has no real verification command.
- Mutation authorization policy is still undecided for production CRUD.
- Search behavior would require schema/index changes not covered by the story.
