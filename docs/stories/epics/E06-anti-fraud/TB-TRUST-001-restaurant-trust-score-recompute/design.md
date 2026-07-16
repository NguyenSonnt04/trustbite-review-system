# Design

## Domain Model

Trust score is a restaurant aggregate (`restaurants.trust_score`, `NUMERIC(3,2)`,
`1.00–5.00`). Inputs per review:

- `reviews.average_rating` — generated average of food/price/service/ambience.
- `reviews.trust_weight_bucket` — `HIGH` | `LOW` | `NONE` (Status_Mapping §2 is the
  authoritative weighting driver).
- reviewer `users.rank_code` — used only for HIGH-bucket weight selection.

Weights (Anti-Fraud §10), in `trustScoreRules.js`:

- HIGH: `NEWBIE 0.5`, `APPRENTICE 0.8`, `FOODIE 1.0`, `TRUSTED_FOODIE 1.5`,
  unknown rank → `0.5`.
- LOW: `0.1`.
- NONE: excluded (weight 0).

## Application Flow

Split mirrors the verification engine (pure math + DB orchestrator):

- `trustScoreCalculator.js` (pure): `weightForReview(bucket, rankCode, rules)` and
  `computeTrustScore(reviews, rules)` → `{ trustScore, verifiedReviewCount,
  referenceReviewCount }`. `sum(rating*weight)/sum(weight)`, clamped and rounded;
  no qualifying reviews → `defaultTrustScore` (5.00).
- `trustScoreService.js`: `recomputeRestaurantTrustScore(restaurantId, { client })`
  takes a `FOR UPDATE` lock on the restaurant before loading public
  VERIFIED/REFERENCE_ONLY reviews in HIGH/LOW buckets joined with
  `users.rank_code`, then computes and writes `trust_score` + counts.
  Persisted legacy `FULL`/`PARTIAL` buckets are normalized to `HIGH`/`LOW` while
  loading so account-deletion recomputation cannot drop pre-vocabulary reviews.
  The lock serializes concurrent recomputes for the same restaurant so the waiter
  reads review changes committed by the prior transaction. The service opens its
  own transaction, or joins a caller-supplied client so a verification/admin/
  deletion flow can recompute atomically.
- `skipReviewReceiptVerification` recomputes before committing both new and
  already-skipped reviews; the idempotent path repairs pre-trigger aggregates.
- Account deletion captures affected restaurant IDs before anonymization, sorts
  them, and calls the shared service after review state changes. This removes the
  former duplicate formula and gives all wired aggregate writers the same lock,
  eligibility, weighting, and neutral-default behavior.

## Interface Contract

No public route/DTO changes. Internal service API:
`recomputeRestaurantTrustScore(restaurantId, { client }?)`; throws
`ValidationError` (bad UUID) and `NotFoundError` (unknown restaurant).

## Data Model

No migration. Reads `reviews.average_rating`, `reviews.trust_weight_bucket`,
`users.rank_code`; writes `restaurants.trust_score`,
`restaurants.verified_review_count`, `restaurants.reference_review_count`,
`updated_at`. Only public VERIFIED/REFERENCE_ONLY reviews in HIGH/LOW buckets (or
legacy aliases FULL/PARTIAL) are eligible, so hidden, private, rejected, deleted,
and pending reviews never affect the score even if legacy data has an
inconsistent bucket.

## UI / Platform Impact

None. Search/detail already read `trust_score`; receipt-free publication and
account deletion now refresh those values transactionally.

## Observability

No audit row: trust score is a derived aggregate, not an audited moderation
decision (Anti-Fraud §11 audits admin/override actions, not recompute). Callers
that make an audited decision (admin verify/reject, deletion) keep their own
audit rows and call recompute within the same transaction.

## Alternatives Considered

1. Categorize by `reviews.status` instead of `trust_weight_bucket` — rejected:
   Status_Mapping §2 mandates trust score be computed by `trustWeightBucket`.
2. Wire recompute directly into `verifyReceipt` now — deferred: it would add
   queries into the well-tested verification transaction and risk destabilizing
   it; the service is instead built callable-with-client for a focused wiring
   slice.
3. Seed the missing ranks and DB-back the weights now — rejected: weights ship as
   constants (Decision 0014 pattern); the calculator tolerates unseeded ranks via
   the default weight.
