# Exec Plan

## Goal

Provide the backend trust-score calculator that recomputes
`restaurants.trust_score` (plus verified/reference counts) from reviews, weighted
by reviewer rank per Anti-Fraud §10, replacing the always-default `5.00`.

## Scope

In scope:

- Pure `computeTrustScore` / `weightForReview` (Anti-Fraud §10, Status_Mapping §2).
- `recomputeRestaurantTrustScore` service persisting score + counts, transaction
  or caller-client.
- Weights/default constants in `trustScoreRules.js`.
- Receipt-free publication and idempotent retry trigger.
- Account-deletion consolidation onto the shared service.
- Read compatibility for persisted `FULL`/`PARTIAL` bucket aliases.
- Unit proof plus committed PostgreSQL integration regressions.

Out of scope (follow-up):

- Wiring recompute into receipt-verification and admin-moderation triggers.
- Per-user reputation score, DB-backed weights, API/UI changes.

## Risk Classification

Risk flags: Data model write (trust score/counts), Existing behavior (search/detail
consume trust_score), Multi-domain (reviews + users + restaurants). No migration.

Hard gate: touches trust-score computation (P0 core rule) → high-risk lane.

## Work Phases

1. Discovery — Anti-Fraud §10, Status_Mapping §2/§3, schema, restaurant search.
2. Design — bucket→weight mapping, zero-review default, pure/DB split.
3. Validation planning — calculator + service unit cases.
4. Implementation — config, calculator, service, tests.
5. Verification — `npm run test:unit`, `npm run server:build`.
6. Harness update — decision, story add/update, product/matrix docs.

## Stop Conditions

Paused/narrowed for:

- "User" vs restaurant trust score ambiguity → resolved to the schema-backed
  restaurant aggregate (no user trust_score column exists); documented in overview.
- Receipt-verification and admin-moderation triggers remain deferred; receipt-free
  publication and account deletion now join the shared service transactionally.
