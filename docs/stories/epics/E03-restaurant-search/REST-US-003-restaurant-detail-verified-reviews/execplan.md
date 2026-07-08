# Execution Plan

## Goal

Prove restaurant detail and public review listing against the accepted public
visibility contract before marking the story implemented.

## Scope

In scope:

- `GET /api/v1/restaurants/:restaurantId` public detail behavior.
- `GET /api/v1/restaurants/:restaurantId/reviews` public review listing.
- Rating breakdown rules for public `VERIFIED` and `REFERENCE_ONLY` reviews.
- Latest owner claim status projection when available.
- Negative-path validation for UUID, review status, pagination, inactive
  restaurants, and soft-deleted restaurants.

Out of scope:

- CRUD mutation behavior.
- Search/filter/nearby behavior.
- Review submission or moderation workflows.
- New schema fields or migrations.
- UI/mobile work.

## Risk Classification

Risk flags:

- Public contracts.
- Data model.
- Existing behavior.
- Weak proof.

Hard gates:

- Public API behavior.
- Persistence behavior.

Lane: high-risk.

## Work Phases

1. Re-read `docs/product/restaurant-discovery.md`, current migrations, and
   restaurant route/controller/service files.
2. Add DB-backed failing tests for non-active and soft-deleted restaurant 404
   behavior.
3. Add DB-backed failing tests for rating breakdown and latest claim status.
4. Add DB-backed failing tests for public review status and visibility filters.
5. Add DB-backed failing tests that public review DTOs omit reviewer `userId`.
6. Make implementation fixes only where the tests expose gaps.
7. Run `npm run db:migrate`, the focused proof command, and
   `npm run server:build`.
8. Attach a real Harness `verify_command` only after the focused proof exists
   and has passed.
9. Refresh story validation evidence, Harness matrix, and trace evidence.

## Stop Conditions

Pause for human confirmation if:

- Current schema cannot represent the accepted detail/review contract.
- Rating-breakdown behavior conflicts with trust-score or review visibility
  product docs.
- A migration or new index becomes necessary.
- Local PostgreSQL/PostGIS cannot run, making DB-backed proof impossible.
- Validation requirements would need to be weakened.
