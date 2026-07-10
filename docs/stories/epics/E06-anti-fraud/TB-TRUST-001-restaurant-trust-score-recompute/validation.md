# Validation

## Proof Strategy

TDD-style unit proof with a mocked `pool`/client (matching the verification
service tests). The pure calculator is proven against the Anti-Fraud §10 weight
table and the zero-review default; the service is proven for transaction
lifecycle, caller-client joining, validation, and not-found.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit — calculator | `weightForReview`: HIGH by rank (0.5/0.8/1.0/1.5), unknown rank → 0.5, LOW → 0.1, NONE/unknown → 0. `computeTrustScore`: empty/null → 5.00 default; NONE excluded; single verified → rating; single reference → rating; rank weighting (FOODIE vs NEWBIE → 3.67); reference down-weight vs verified (→ 4.64); string NUMERIC parsing; verified with null rating counted but excluded from math; result within 1.00–5.00. |
| Unit — service | Invalid UUID → `ValidationError` before connect; own transaction persists computed `[trustScore, verified, reference]` and commits; zero qualifying reviews → default 5.00 persisted; caller-provided client is joined (no BEGIN/COMMIT/release, pool untouched); unknown restaurant (update rowCount 0) → `NotFoundError` + ROLLBACK; query error → ROLLBACK + release. |
| Integration | Deferred: no schema change; live recompute proof needs local PostgreSQL. |
| E2E / Platform | Not applicable — no UI/provider surface. |
| Logs/Audit | None: trust score is a derived aggregate, not an audited decision. |

## Commands

```text
npx vitest run tests/unit/trust/
npm run test:unit --prefix server
npm run server:build
```

## Acceptance Evidence

Validated 2026-07-10:

- `npx vitest run tests/unit/trust/` — 2 files / 19 tests passed.
- `npm run test:unit` — 23 files / 251 tests passed (was 232; +19).
- `npm run server:build` — syntax check passed for 107 files.

## DB Proof

PASS (2026-07-10) against local PostgreSQL (`trustbite-postgres`, `npm run db:migrate`
applied). A throwaway script seeded, inside one transaction, a restaurant with a
verified FOODIE review (avg 5, weight 1.0), a reference review (avg 1, weight 0.1),
and a rejected NONE review (excluded), then called
`recomputeRestaurantTrustScore(restaurantId, { client })` joining that transaction:

- returned `{ trustScore: 4.64, verifiedReviewCount: 1, referenceReviewCount: 1 }`
  (`(5*1.0 + 1*0.1)/1.1 = 4.636 → 4.64`),
- `restaurants.trust_score` / `verified_review_count` / `reference_review_count`
  persisted `4.64` / `1` / `1`,
- NONE-bucket review excluded from both math and counts.

The transaction was rolled back; residue check afterward found 0 rows. The script
was removed after running (not committed). Remaining: no committed integration
test and no auto-recompute trigger yet (recompute is not wired into
verification/admin/deletion).
