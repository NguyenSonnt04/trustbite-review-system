# 0019 Gamification level derived in code; read-only summary API first

Date: 2026-07-10

## Status

Accepted

## Context

Gamification data exists in the schema (`users.exp_points`/`rank_code`,
`rank_definitions`, `badge_definitions`, `user_badges`, `exp_transactions`) but
nothing computes or exposes it. Gamification_Design §3 defines a level ladder
where each tier needs both an EXP threshold and a verified-review count, but
`rank_definitions` seeds only NEWBIE and holds only `min_exp` (no verified-review
condition). The task asks for a gamification API (points, badges, level).

## Decision

- Ship a backend-owned, authenticated **read** API first:
  `GET /api/v1/users/me/gamification` returning points, derived level +
  next-level progress, and badges.
- Derive the level in code from `exp_points` + verified review count via a rank
  ladder held as frozen constants in `gamificationRules.js` (Decision 0014
  pattern), not from `users.rank_code` (no writer maintains it yet) and not from
  `rank_definitions` (unseeded, and it cannot express the verified-review
  condition).
- Defer EXP awarding writes, `rank_code` persistence, and badge-award triggers
  to a later write slice; badges are P1 (Gamification_Design §5), so the API
  lists whatever is in `user_badges`.
- No schema migration; no `rank_definitions` seeding.

## Alternatives Considered

1. Return persisted `users.rank_code` as the level — rejected: always NEWBIE
   until a writer exists.
2. Seed the non-Newbie ranks and back the ladder with `rank_definitions` —
   rejected: a data migration, and the table cannot hold the verified-review
   condition; the code ladder is the source of truth for now.
3. Include EXP awarding in this slice — deferred: awarding wires into the review
   submit / verification-decision paths and is a separable write slice.

## Consequences

Positive:

- Points/level/badges are exposed now, with an exhaustively testable pure ladder
  and no schema risk.
- The rank ladder constants are shared by the future awarder for consistency.

Tradeoffs:

- `exp_points` stays 0 for everyone until the awarding writer lands, so the API
  returns NEWBIE for all users in the interim.
- The derived level and persisted `rank_code` can diverge once EXP is awarded;
  the write slice must persist `rank_code` (which the trust-score weighting reads)
  to reconcile them.

## Follow-Up

- Write slice: award EXP on review submit/verify (`+10` capped 2/day, `+50`
  verified, revoke on hide/reject) and persist `rank_code`.
- Badge-award triggers when badges leave P1.
- Live route + DB proof when local PostgreSQL is available.
