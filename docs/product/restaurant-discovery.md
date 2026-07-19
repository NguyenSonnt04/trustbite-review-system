# Restaurant Discovery Product Contract

## Status

Accepted planning contract for Phase 3 backend implementation. This document
narrows the older `trustbite-docs` restaurant API notes into the behavior that
stories and tests should prove before UI/mobile work depends on it.

## Scope

Restaurant discovery covers public restaurant list/search, map-bounds lookup,
restaurant detail, active electronic menu items, and public
verified/reference review listing.

It does not cover review creation, OCR verification, external map provider
integration, or trust score recalculation jobs. Restaurant image management and
merchant claim evidence are covered by the media-management story.

## Source Documents

- `trustbite-docs/04_Software_Engineering/API_Specification.md` section 4
- `trustbite-docs/04_Software_Engineering/openapi.yaml` restaurant paths
- `trustbite-docs/02_Business_Analysis/Business_Rules.md` BR-REST-001 through BR-REST-003
- `trustbite-docs/00_Document_Control/Traceability_Matrix.md` row "Xem/tim quan ACTIVE"
- `server/migrations/001_init_schema.sql`

## Public Visibility Rules

- Public discovery endpoints return only restaurants where `status = 'ACTIVE'`
  and `is_deleted = FALSE`.
- `DRAFT`, `SUSPENDED`, `CLOSED`, and soft-deleted restaurants are not public.
- Public review lists return only `VERIFIED` and `REFERENCE_ONLY` reviews with
  `public_visibility = 'PUBLIC'`.
- `HIDDEN`, `DELETED`, rejected, private, or otherwise non-public reviews never
  appear on public restaurant endpoints and do not feed public rating
  breakdowns.

## API Contract

### GET `/api/v1/restaurants`

Purpose: searchable public list for active restaurants.

Query parameters:

| Parameter | Contract |
| --- | --- |
| `keyword` | Optional single string. Trim before search. Match against restaurant name with case-insensitive partial search. |
| `lat` | Optional latitude in `[-90, 90]`. Must be supplied with `lng` when location search is used. |
| `lng` | Optional longitude in `[-180, 180]`. Must be supplied with `lat` when location search is used. |
| `radiusMeters` | Optional integer in `[1, 50000]`. Valid only with `lat` and `lng`. If `lat/lng` are supplied and this is omitted, use 5000 meters. |
| `minTrustScore` | Optional decimal in `[0, 5]`. Filters on `restaurants.trust_score`. Restaurants with null trust score are excluded only when this filter is present. |
| `sort` | Optional enum: `name`, `trustScoreDesc`, `distanceAsc`. Default is `name`. `distanceAsc` requires `lat/lng`. |
| `page` | Optional positive integer. Default `1`. |
| `pageSize` | Optional positive integer. Default `20`, maximum `100`. |

Response shape remains the current page envelope:

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "total": 0
}
```

Each item includes the current public restaurant fields plus:

- `primaryImageUrl`: nullable display-ready URL for the newest restaurant-level
  image where `branch_id IS NULL` and `is_primary = TRUE`. Non-primary images,
  branch images, and private receipt evidence are never selected. It is a
  validated legacy HTTPS URL or short-lived signed URL and never exposes the
  stored `s3://` reference.
- `distanceMeters` when location search or map-bounds lookup computes a
  distance.

Invalid query combinations return the standard error envelope with HTTP `422`
and `VALIDATION_ERROR`. Invalid numeric syntax such as `1abc` is rejected, not
partially parsed.

### GET `/api/v1/restaurants/nearby`

Purpose: map viewport lookup for active restaurants.

Query parameters:

| Parameter | Contract |
| --- | --- |
| `northEastLat` | Required latitude in `[-90, 90]`. |
| `northEastLng` | Required longitude in `[-180, 180]`. |
| `southWestLat` | Required latitude in `[-90, 90]`. |
| `southWestLng` | Required longitude in `[-180, 180]`. |
| `page` | Optional positive integer. Default `1`. |
| `pageSize` | Optional positive integer. Default `100`, maximum `250`. |

The viewport must be a valid non-empty rectangle where north-east latitude is
greater than south-west latitude and north-east longitude is greater than
south-west longitude. Antimeridian wrapping is out of scope for Phase 3;
requests where `northEastLng <= southWestLng` are invalid and return
`422 VALIDATION_ERROR`.

### GET `/api/v1/restaurants/:restaurantId`

Purpose: public restaurant detail page.

The endpoint returns the public restaurant profile, `ratingBreakdown`, and the
latest `ownerClaimStatus` when available. Non-active, soft-deleted, or unknown
restaurants return `404 RESTAURANT_NOT_FOUND`.

### GET `/api/v1/restaurants/:restaurantId/reviews`

Purpose: public paginated reviews for a restaurant detail page.

Query parameters:

| Parameter | Contract |
| --- | --- |
| `status` | Optional enum: `VERIFIED`, `REFERENCE_ONLY`, `ALL`. Default `ALL`. |
| `page` | Optional positive integer. Default `1`. |
| `pageSize` | Optional positive integer. Default `20`, maximum `100`. |

The response must distinguish `VERIFIED` from `REFERENCE_ONLY` so clients can
render trust badges without guessing. Public responses expose the author's
trimmed `reviewerDisplayName`, or `Người dùng TrustBite` when the profile name
is blank or the author is deleted. They continue to omit reviewer `userId`,
Cognito subject, email, phone number, avatar, helpful counts, replies, receipt
data, and media.

### GET `/api/v1/restaurants/:restaurantId/menu`

Purpose: public electronic menu for a restaurant detail page.

The endpoint returns active `menu_items` ordered by name and ID. Each item
exposes `id`, `name`, numeric `price` from `price_default`, and `currency`.
Default pagination is page `1` with `50` items and a maximum page size of
`100`. The endpoint does not infer branch-specific prices or dish images.
Non-active, soft-deleted, or unknown restaurants return `404 NOT_FOUND`.

### GET, POST `/api/v1/restaurants/:restaurantId/images`

Purpose: protected listing and upload of restaurant profile images.

- Allows authenticated TrustBite-local `ADMIN`/`SUPER_ADMIN`, or an active
  merchant with an active `OWNER`/`MANAGER` assignment for the restaurant.
- Requires a UUID v4 `Idempotency-Key`.
- Accepts one multipart `restaurantImage` file: JPEG, PNG, or WebP, maximum
  5 MB.
- Optional `caption` is trimmed and limited to 255 characters.
- Optional `isPrimary` accepts strict `true` or `false` and defaults to `true`.
- The object is stored privately in the configured restaurant-image S3 bucket.
  The persisted `image_url` is a stable `s3://` reference scoped to that bucket.
  Upload, list, nearby, and detail responses convert owned references into
  short-lived HTTPS presigned GET URLs. Legacy HTTPS rows remain displayable.
- A primary upload clears existing restaurant-level primary flags and inserts
  the new row in the same transaction.
- Provider success followed by persistence failure triggers best-effort S3
  deletion. Successful uploads write an audit row.
- `STAFF`, inactive assignments, suspended merchants, and cross-restaurant
  access are denied.

### DELETE `/api/v1/restaurants/:restaurantId/images/:imageId`

- Uses the same authorization policy and requires UUID v4 `Idempotency-Key`.
- Deleting the primary image promotes the newest remaining restaurant-level
  image by `created_at DESC, id DESC`.
- Database deletion is transactional. S3 cleanup is durable and retryable
  through idempotency state.

### Merchant claim evidence

- Merchant ownership/management evidence is stored privately under
  `receipts/merchant-claims/`, never as customer receipt verification data.
- Claims request `OWNER` or `MANAGER`. Admin approval activates the merchant,
  ensures the local role, and provisions the active restaurant assignment.

### Authenticated Favorites

Mobile MVP uses one private default list named `Yêu thích`:

- `GET /api/v1/users/me/favorites` returns saved active restaurant cards newest
  first.
- `PUT /api/v1/users/me/favorites/:restaurantId` saves idempotently.
- `DELETE /api/v1/users/me/favorites/:restaurantId` removes idempotently.

These routes never expose or mutate another user's saved list. Named/public
collections remain out of scope.

## Data And Implementation Boundary

- Use the existing `restaurants.geo` PostGIS `GEOGRAPHY(Point, 4326)` column
  and existing plain `latitude`/`longitude` columns.
- Keep `geo` synchronized with `latitude` and `longitude` on restaurant writes.
- Use `ST_DWithin` for radius filtering and deterministic distance calculation.
- Use a map-bounds predicate against `geo` for `/nearby`; if the current index
  is insufficient, create a separate schema story before changing indexes.
- Do not add new restaurant fields without migration, rollback/reset proof, and
  story updates.
- Controllers validate HTTP input before calling services. Services own SQL and
  transaction boundaries.
- Restaurant image selection is deterministic when legacy data contains more
  than one primary image: newest `created_at`, then highest image `id`.
- Receipt evidence URLs are private verification data and must never be exposed
  as restaurant profile images.

## Admin Restaurant Management

- `ADMIN` and `SUPER_ADMIN` use the opaque-session admin BFF to list all
  non-deleted restaurants, including non-public statuses.
- Admin detail may update the existing restaurant profile fields, coordinates,
  categories, and status. Every update requires an administrative reason and
  writes an audit record.
- Restaurant media mutations are available only through admin-web routes.
- Images accept one JPEG, PNG, or WebP file up to 5 MB after MIME, extension,
  and file-signature validation.
- PostgreSQL stores stable private `s3://` references. API responses return
  short-lived signed image URLs.
- Admins may upload, replace, caption, select a primary image, and remove
  images. Removing a primary image promotes the newest remaining image.
- TrustBite deletes only allowlisted owned objects under
  `restaurant-images/<restaurantId>/`; external legacy URLs are never deleted.

## Current Code Baseline

| Behavior | Current state | Required Phase 3 closeout |
| --- | --- | --- |
| CRUD routes | Present in `server/src/routes/restaurant.js` with auth on mutating routes | Add DB-backed proof and decide production authorization boundary for mutations |
| Public list | Implemented with `keyword`, `lat/lng/radiusMeters`, `minTrustScore`, `sort`, strict validation, ACTIVE-only filtering, and DB proof | Keep docs, integration proof, and Harness matrix current |
| Mobile Discover cards | Loads the first ten public restaurant summaries sorted by trust score, including nullable primary image URLs | Add device location as a separate story before claiming GPS-nearby ordering |
| Mobile restaurant detail | Tapping a Discover card loads the selected public detail, active electronic menu, and first page of public reviews by restaurant ID; review cards show the backend-issued reviewer display name, comment, score, time, and trust status | Add avatars, helpful counts, replies, or media only after their public API contracts are defined |
| `/restaurants/nearby` | Implemented before `/:restaurantId` with strict bounds validation and map-bounds DB proof | Keep route ordering and map-bounds proof current |
| Detail | Implemented via `getRestaurantDetail` with DB-backed proof for active/soft-delete gates, rating breakdown, and latest owner claim status | Keep DB-backed detail proof current |
| Public reviews | Implemented via `listPublicReviewsByRestaurant` with DB-backed proof for status/visibility filters, privacy-safe `reviewerDisplayName`, deleted-user fallback, and omitted private identity fields | Keep public review proof current |
| Public menu | Implemented from active `menu_items` with default price/currency and public restaurant visibility gates | Branch-specific availability, prices, descriptions, categories, and dish images require separate contracts |

## Validation Contract

Before Phase 3 backend is claimed complete:

- Run `npm run db:migrate` against local PostgreSQL.
- Add DB-backed route/service tests for CRUD, search/filter/nearby, detail, and
  public reviews.
- Prove inserts/updates occur in transactions and are rolled back or cleaned up
  without residue.
- Run `npm run server:build`.
- Add accurate Harness `verify_command` values only after the commands really
  exercise the story behavior.
- Refresh story packets, Harness matrix, and trace evidence in the same change.
