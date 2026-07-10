# Gamification Product Contract

TrustBite gamification (EXP, level/rank, badges) exists to encourage genuine,
receipt-backed reviews. Backend is the source of truth; the client never computes
points or level. Points/rank carry no monetary value and can be revoked on fraud
(Terms of Service).

## EXP Values (Gamification_Design §2)

- Valid reference review: `+10` EXP (at most 2 reference reviews/day earn EXP).
- Review verified by receipt/risk/admin: `+50` EXP.
- Helpful vote received: `+5` EXP (P1).
- Rejected/hidden review: `0` or revoked per moderation.

EXP awarding (writes) and `users.rank_code` persistence are a tracked follow-up;
the values above ship as shared constants for the awarder and the read API.

## Level Ladder (Gamification_Design §3)

A level is reached only when BOTH its EXP threshold and its verified-review count
are met:

| Level | Min EXP | Min verified reviews |
| --- | ---: | ---: |
| NEWBIE | 0 | 0 |
| APPRENTICE | 100 | 2 |
| FOODIE | 500 | 10 |
| TRUSTED_FOODIE | 2000 | 25 |

`FOODGOD` is future/secret and not part of the MVP ladder. The reviewer level
feeds the restaurant trust-score weighting for verified reviews (see
`verification.md`).

## Summary API (`TB-GAMIFY-001`)

`GET /api/v1/users/me/gamification` (authenticated) returns the current user's:

- `expPoints` — persisted EXP.
- `verifiedReviewCount` — count of the user's `VERIFIED` reviews.
- `level` — derived from EXP + verified count via the ladder above
  (`{ code, label, minExp, minVerifiedReviews }`).
- `nextLevel` — next tier with `expToNext` and `verifiedReviewsToNext`, or `null`
  at the top tier.
- `badges` — the user's awarded badges (`user_badges`), each
  `{ code, label, iconUrl, category, awardedAt }`.

The level is derived from persisted data (not read from `users.rank_code`), so it
is correct even before an EXP/rank writer reconciles `rank_code`.

## Badges

Badge definitions and awards use `badge_definitions` / `user_badges`. Badge
award triggers are P1/future (Gamification_Design §5); the API lists whatever has
been awarded.
