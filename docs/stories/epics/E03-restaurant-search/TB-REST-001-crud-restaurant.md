# TB-REST-001 API: CRUD Restaurant

## Status

in-progress

## Lane

normal

## Product Contract

Expose five CRUD endpoints under `/api/v1/restaurants` for creating, reading,
updating, and soft-deleting restaurant records. Every restaurant stores a
PostGIS `GEOGRAPHY(Point, 4326)` location alongside plain `latitude`/`longitude`
columns. Status transitions (`DRAFT → ACTIVE → SUSPENDED / CLOSED`) control
public visibility per BR-REST-001 and BR-REST-003.

## Relevant Product Docs

- `trustbite-docs/04_Software_Engineering/API_Specification.md` — Section 4 (Quán)
- `trustbite-docs/06_Database_Design/PostgreSQL_Database_Schema.md` — Section 3.2
- `trustbite-docs/02_Business_Analysis/Business_Rules.md` — BR-REST-001/002/003
- `docs/ARCHITECTURE.md` — Dependency rule, boundary inputs

## Acceptance Criteria

- `POST /api/v1/restaurants` creates a restaurant (name, description, address,
  phone_number, latitude, longitude, category_ids) with default status `DRAFT`;
  `geo` column auto-set from lat/lng; slug auto-generated from name.
- `GET /api/v1/restaurants` lists restaurants with pagination (`page`, `pageSize`);
  supports optional `keyword` filter (name ILIKE); returns camelCase response.
- `GET /api/v1/restaurants/:restaurantId` returns a single restaurant by UUID.
- `PATCH /api/v1/restaurants/:restaurantId` updates allowed fields (name,
  description, address, phone_number, latitude, longitude, status, category_ids);
  geo auto-updated when lat/lng change.
- `DELETE /api/v1/restaurants/:restaurantId` soft-deletes by setting
  `status = 'CLOSED'`.
- All endpoints parse and validate input at the HTTP boundary before calling
  the service layer.
- Error responses follow the standard `{ error: { code, message, requestId } }`
  envelope.
- Status transitions: only valid values
  (`DRAFT`, `ACTIVE`, `SUSPENDED`, `CLOSED`) accepted on PATCH.
- `geo` is always kept in sync with `latitude`/`longitude`.

## Design Notes

- **Routes**: `server/src/routes/restaurant.js`
- **Controller**: `server/src/controllers/restaurant.js`
- **Service**: `server/src/services/restaurantService.js` (new)
- **Model**: `server/src/models/restaurant/restaurant.js` (existing, no change)
- **Tables**: `restaurants`, `restaurant_category_map`
- **Domain rules**:
  - BR-REST-001: list endpoint only returns `ACTIVE` restaurants by default;
    admin-scoped listing is out of scope for this story.
  - BR-REST-003: status `SUSPENDED` blocks new reviews (enforced at review
    creation, not here).
  - Slug generated as `slugify(name) + '-' + 6 random hex chars` to ensure
    uniqueness.
  - PostGIS `geo` written as
    `ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)`.
- **API shape**: follows `API_Specification.md` Section 4 conventions.
- **Auth**: endpoints are currently unprotected (auth middleware is a skeleton);
  auth guard will be wired in a future auth story.
- **UI surfaces**: none for this story (backend only).

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | Input validation rejects missing name, invalid UUID, invalid status |
| Integration | `npm run docker:up` + manual `curl` smoke through all 5 endpoints |
| E2E | Not in scope for this story |
| Platform | Not in scope for this story |
| Release | Not in scope for this story |

## Harness Delta

None — no harness CLI records updated; no test matrix row created yet because
automated backend tests do not exist (see ARCHITECTURE.md Current Gaps).

## Evidence

- Review fixes applied for public `ACTIVE`-only listing, snake_case request fields, strict pagination parsing, optional text validation, category ID validation, coordinate clearing, and slug collision retry.
- Soft-delete logic refined: DELETE is now truly idempotent (returns success even if already closed).
- `npm run harness -- query matrix` attempted; local Harness CLI binary was not installed.
- Backend syntax/import smoke was run with `node --check` and a dynamic import of `server/src/app.js`.
- Manual database-backed CRUD smoke remains required with Docker/Postgres because this repository currently has no automated backend test script.