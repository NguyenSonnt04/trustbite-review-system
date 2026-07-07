# REST-US-003: Restaurant Detail and Verified Reviews

## Status

in_progress

## Lane

high-risk

## Product Contract

Public restaurant detail must expose the active restaurant profile, rating
breakdown, latest owner claim status, and a paginated public review list that
distinguishes `VERIFIED` from `REFERENCE_ONLY`.

The code path exists, but Phase 3 cannot call this story complete until
database-backed integration proof and Harness verification exist.

## Affected Users

- Public users reading restaurant detail pages and public reviews.
- Client/mobile UI teams that need a stable detail/review response contract.

## Relevant Product Docs

- `docs/product/restaurant-discovery.md`
- `trustbite-docs/04_Software_Engineering/API_Specification.md`
- `trustbite-docs/00_Document_Control/Traceability_Matrix.md`
- `trustbite-docs/02_Business_Analysis/Business_Rules.md` BR-REST-001, BR-REV-005, BR-REV-008
- `docs/ARCHITECTURE.md`
- `docs/CONTEXT_RULES.md`

## Non-Goals

- Restaurant CRUD write behavior; covered by `TB-REST-001`.
- Search/filter/nearby API behavior; covered by `TB-REST-002`.
- Review creation, moderation, receipt/OCR verification, or trust-score
  recalculation.
- UI/mobile implementation.

## Harness Delta

Story remains `in_progress` for Phase 3 closeout. Unit-level proof is useful
but insufficient because the acceptance criteria depend on SQL, schema, and
public persistence behavior.

## Evidence Gap

Previous proof covered unit behavior and backend syntax. Missing proof is the
database-backed integration path against migrated PostgreSQL with rollback or
fixture cleanup.
