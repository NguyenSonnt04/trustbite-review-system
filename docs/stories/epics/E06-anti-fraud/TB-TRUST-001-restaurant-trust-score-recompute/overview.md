# TB-TRUST-001 Restaurant Trust Score Computation

## Terminology note

The task sheet names this "trust score for user". TrustBite's schema has **no
per-user trust_score column** — user reputation is `users.exp_points` /
`users.rank_code` (gamification). The only trust score in the schema and specs is
`restaurants.trust_score` (`NUMERIC(3,2)`, `1.00–5.00`), and Anti-Fraud §10
computes it as a weighted average of review ratings **weighted by the reviewer's
rank**. This story implements that backend calculator. A distinct per-user
reputation score is not defined by the schema/spec and would be a separate
initiative (new column + migration + decision).

## Current Behavior

`restaurants.trust_score` defaults to `5.00` and is consumed by restaurant
search (`minTrustScore` filter, `trustScoreDesc` sort) and detail, but no service
ever recomputes it — every restaurant is stuck at the default. ARCHITECTURE.md
lists "trust-score computation" as a gap, and the account-deletion retention
story flags the "trust-score calculator" as absent.

## Target Behavior

- A backend service computes `restaurants.trust_score` from the restaurant's
  reviews using Anti-Fraud §10 weights, driven by `reviews.trust_weight_bucket`
  (Status_Mapping §2: "Trust score chỉ tính theo trustWeightBucket"):
  - `HIGH` (VERIFIED) → weight by reviewer `rank_code`
    (Newbie 0.5 / Apprentice 0.8 / Foodie 1.0 / Trusted Foodie 1.5),
  - `LOW` (REFERENCE_ONLY) → 0.1,
  - `NONE` (hidden/rejected/deleted/pending) → excluded.
- `RestTrustScore = sum(Rating_i * weight_i) / sum(weight_i)`, clamped to
  `1.00–5.00` and rounded to 2 decimals. Rating_i is `reviews.average_rating`
  (generated average of the 4 criteria).
- With no qualifying (HIGH/LOW) reviews, the score resets to the neutral default
  `5.00`.
- The service also recomputes `verified_review_count` (HIGH) and
  `reference_review_count` (LOW).
- Backend is the source of truth; the client never computes trust score.

## Affected Users

- Diners relying on the trust score in search/detail.
- Admins/ops whose moderation and deletion actions should trigger recompute.

## Affected Product Docs

- `docs/product/verification.md`
- `trustbite-docs/05_Security_Algorithms/Anti_Fraud_Specification.md` (§10)
- `trustbite-docs/02_Business_Analysis/Status_Mapping.md` (§2, §3)

## Status

in-progress

Delivered:

- Pure `computeTrustScore` calculator + `weightForReview` (Anti-Fraud §10).
- `recomputeRestaurantTrustScore(restaurantId, { client })` service that persists
  `trust_score` + counts, joining a caller transaction or opening its own.
- Weights/default as frozen constants in `trustScoreRules.js`.
- Receipt-free review publication recomputes before commit; retrying an already
  skipped review repairs aggregates written before this trigger existed.
- Account deletion uses the same rank-weighted service for affected restaurants,
  in deterministic restaurant-id order, instead of maintaining a second formula.
- Shared aggregate reads normalize persisted `FULL`/`PARTIAL` aliases to
  `HIGH`/`LOW`, preserving pre-vocabulary review contributions without a schema
  migration.

Deferred (follow-up, not in this slice):

- Wiring recompute into receipt-verification and admin-moderation decisions.

PostgreSQL proof completed 2026-07-17: focused review-status and
account-deletion integration coverage passed 2 files / 32 tests after applying
pending migrations 009 and 010.

## Non-Goals

- New per-user trust_score column or per-user reputation score.
- Any schema migration (uses existing columns).
- Public API/route changes, UI/mobile presentation.
- DB-backed tunable weights (weights ship as constants, like `fraudRules.js`).
