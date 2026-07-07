# TB-REST-001: Restaurant CRUD API Closeout

## Status

in_progress

## Lane

high-risk

## Product Contract

Close out the existing restaurant CRUD API against the Phase 3 restaurant
discovery contract. The code already exposes create, list, detail, update, and
soft-delete routes under `/api/v1/restaurants`; this story is not complete
until database-backed proof and Harness verification exist.

## Affected Users

- Authenticated internal/admin or approved restaurant-ownership operators who
  create, update, or retire restaurant records.
- Public users who must never see soft-deleted or non-active restaurant records
  through discovery endpoints.

## Relevant Product Docs

- `docs/product/restaurant-discovery.md`
- `trustbite-docs/04_Software_Engineering/API_Specification.md` section 4
- `trustbite-docs/06_Database_Design/PostgreSQL_Database_Schema.md` section 3.2
- `trustbite-docs/02_Business_Analysis/Business_Rules.md` BR-REST-001 through BR-REST-003
- `docs/ARCHITECTURE.md`
- `docs/CONTEXT_RULES.md`

## Non-Goals

- Public search/filter/nearby behavior; covered by `TB-REST-002`.
- Restaurant detail plus public verified/reference review closeout; covered by
  `REST-US-003`.
- UI/mobile restaurant management screens.
- Schema/index changes unless a separate high-risk schema story accepts them.

## Harness Delta

Selected Phase 3 backend story. Matrix status should remain `in_progress`
until DB-backed proof and an accurate verify command exist.

## Evidence Gap

The current code compiles and unit tests exist for adjacent restaurant detail
behavior, but CRUD still lacks durable local database proof. This is the next
work item before calling the CRUD slice complete.
