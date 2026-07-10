# 0018 Restaurant trust score computed by trustWeightBucket + reviewer rank

Date: 2026-07-10

## Status

Accepted

## Context

`restaurants.trust_score` (`NUMERIC(3,2)`, `1.00–5.00`) is consumed by restaurant
search/detail but no service recomputes it, so it is always the `5.00` default.
Two docs govern the formula: Anti-Fraud §10 defines
`RestTrustScore = sum(Rating_i * weight_i) / sum(weight_i)` with weights by
review type and reviewer rank; Status_Mapping §2 states trust score is computed
"chỉ theo trustWeightBucket". The task sheet names it "trust score for user", but
TrustBite has no per-user trust_score column (user reputation is EXP/rank).

## Decision

- Implement the schema-backed **restaurant** trust score. There is no per-user
  trust_score; a user reputation score would be a separate initiative.
- Categorize each review by `reviews.trust_weight_bucket` (Status_Mapping §2):
  `HIGH` → verified, weighted by reviewer `rank_code`
  (Newbie 0.5 / Apprentice 0.8 / Foodie 1.0 / Trusted Foodie 1.5, unknown → 0.5);
  `LOW` → reference (0.1); `NONE` → excluded.
- Weights ship as frozen constants in `trustScoreRules.js` (Decision 0014
  pattern), consumed by a pure calculator; a DB service persists score + counts.
- With no qualifying (HIGH/LOW) reviews, reset to the neutral default `5.00`.
- Do not add an audit row for recompute (derived aggregate, not an audited
  decision per Anti-Fraud §11).

## Alternatives Considered

1. Categorize by `reviews.status` — rejected: Status_Mapping §2 mandates
   `trustWeightBucket` as the weighting driver.
2. Add a per-user trust_score column now — rejected: not defined by schema/spec;
   out of scope and would need a migration/decision.
3. Wire recompute into `verifyReceipt` in this slice — deferred to a focused
   wiring slice to avoid destabilizing the verification test path; the service is
   built to join a caller transaction via an optional client.

## Consequences

Positive:

- `trust_score` can reflect verified-review quality weighted by reviewer trust,
  unblocking the search/detail filters and the deletion-retention recompute
  dependency.
- Pure calculator is exhaustively unit-testable; no schema change.

Tradeoffs:

- The score does not update automatically until recompute is wired to triggers
  (verification/admin/deletion) in a follow-up.
- Unseeded ranks fall back to the Newbie weight until rank definitions are seeded.

## Follow-Up

- Wire `recomputeRestaurantTrustScore` into the verification decision, admin
  moderation decisions, and the deletion/anonymization job (shared client).
- Live DB recompute + rollback proof when local PostgreSQL is available.
- Seed the non-Newbie rank_definitions rows if/when gamification ranks land.
