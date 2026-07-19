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
| Unit — service | Invalid UUID → `ValidationError` before connect; own transaction follows `BEGIN → lock restaurant → load eligible public reviews → update restaurant → COMMIT`; persisted FULL/PARTIAL aliases normalize to HIGH/LOW in the aggregate query; zero qualifying reviews → default 5.00 persisted; caller-provided client joins without BEGIN/COMMIT/release or pool use; unknown restaurant and query errors roll back owned transactions. Review publication proves new transition, idempotent repair, and recompute-failure rollback. |
| Integration | Receipt-free publication retry repairs stale counts; concurrent caller transactions delete a verified review and publish a reference review, finishing with only the surviving reference counted; account deletion excludes deleted/hidden reviews, preserves a surviving legacy FULL review through the shared formula, and resets an empty restaurant to 5.00. Focused PostgreSQL proof passed 2 files / 32 tests on 2026-07-17. |
| E2E / Platform | Not applicable — no UI/provider surface. |
| Logs/Audit | None: trust score is a derived aggregate, not an audited decision. |

## Commands

```text
npx vitest run tests/unit/trust/
npm run test:unit --prefix server
npm run test:integration:files --prefix server -- tests/integration/reviewStatus.integration.test.js tests/integration/accountDeletionProcessor.integration.test.js
npm run server:build
```

## Acceptance Evidence

Validated 2026-07-17 review-finding closeout:

- Docker Desktop/PostgreSQL became available and `npm run db:migrate` applied
  pending migrations 009 and 010 successfully.
- Focused review-status + account-deletion integration proof passed 2 files /
  32 tests, covering retry repair, lock serialization, legacy FULL preservation,
  deletion exclusion, and neutral-default reset.
- Added `test:integration:files` so story proof accepts exact Vitest file paths
  instead of unintentionally launching the complete integration directory.
- `npm run harness -- story verify TB-TRUST-001` passed the full server suite:
  65 files / 579 tests passed, with 2 files / 4 opt-in provider tests skipped.

Validated 2026-07-16 compatibility follow-up:

- Red proof: the focused trust-score service test failed because the aggregate
  query did not normalize `FULL`/`PARTIAL` or include them in its eligible set.
- Green proof: `npx vitest run tests/unit/trust/trustScoreService.test.js` passed
  1 file / 6 tests after mapping `FULL → HIGH` and `PARTIAL → LOW`.
- `npm run test:unit --prefix server` passed 45 files / 424 tests.
- `npm run server:build` passed syntax checking for 134 files.
- The account-deletion integration regression now leaves a public legacy `FULL`
  review behind and expects it to contribute to score/count recomputation.
- `npm run db:migrate` and the integration suite remained blocked by
  `ECONNREFUSED localhost:15432`; no fresh PostgreSQL success is claimed.
- Decision 0018 and its durable Harness record now describe wired triggers,
  legacy read compatibility, and the remaining migration/trigger follow-ups.

Validated 2026-07-16 concurrency follow-up:

- Regression test failed before the fix because recompute loaded reviews without
  first locking the restaurant.
- `npx vitest run tests/unit/trust/trustScoreService.test.js` — 1 file / 6 tests
  passed after enforcing lock-before-load order for owned and borrowed clients.
- `npm run test:unit --prefix server` — 45 files / 424 tests passed.
- `npm run server:build` — syntax check passed for 134 files.
- `npm run db:migrate` could not connect because the local Docker Desktop engine
  was not running; no new live PostgreSQL concurrency proof is claimed.
- Added committed regressions for deletion-vs-reference-publication lock
  serialization, idempotent receipt-skip repair, recompute-failure rollback, and
  account-deletion reuse of the shared rank-weighted/default-5.00 service. Unit
  proof passes; DB cases await an available Docker/PostgreSQL runtime.
- Targeted integration rerun: 1 non-DB provider-double test passed; 31 DB cases
  failed at setup with `ECONNREFUSED localhost:15432`. `npm run db:migrate` was
  also blocked because Docker Desktop was not running; no DB success is claimed.

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
was removed after running. Committed integration coverage now exists for
receipt-free publication, concurrency, and account-deletion recomputation;
receipt-verification and admin-moderation trigger wiring remain follow-ups.
