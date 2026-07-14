# TB-GAMIFY-001 User Gamification Summary API

## Current Behavior

The schema carries gamification data (`users.exp_points`, `users.rank_code`,
`rank_definitions`, `badge_definitions`, `user_badges`, `exp_transactions`) and
the models exist, but there is no service or API. No EXP is awarded, no rank is
computed, and there is no endpoint to read a user's points/level/badges.

## Target Behavior

- A backend-owned, authenticated read API exposes the current user's
  gamification summary:
  `GET /api/v1/users/me/gamification` →
  `{ expPoints, verifiedReviewCount, level, nextLevel, badges }`.
- `level` is derived from `exp_points` + verified review count via the
  Gamification_Design §3 ladder (NEWBIE 0 / APPRENTICE 100+≥2 verified /
  FOODIE 500+≥10 / TRUSTED_FOODIE 2000+≥25). A level requires BOTH its EXP and
  verified-review thresholds.
- `nextLevel` reports the next tier plus `expToNext` and `verifiedReviewsToNext`,
  or `null` at the top tier.
- `badges` lists the user's awarded badges from `user_badges`.
- Backend is the source of truth; the client never computes level/points.

## Affected Users

- Authenticated users viewing their own profile/progress.

## Affected Product Docs

- `docs/product/gamification.md`
- `trustbite-docs/05_Security_Algorithms/Gamification_Design.md` (§2, §3)

## Status

in-progress

Delivered in this slice (unit-proven):

- EXP values + rank ladder as frozen constants (`gamificationRules.js`).
- Pure `resolveRank(expPoints, verifiedReviewCount, rules)`.
- `getUserGamification(userId)` read service + `GET /users/me/gamification`
  (auth-protected) returning points/level/progress/badges.

Deferred (follow-up, not in this slice):

- EXP awarding writes (`+10` reference capped 2/day, `+50` verified, revoke on
  hide/reject) and `users.rank_code` persistence, wired into review submit and
  the verification decision.
- Badge awarding logic (Gamification_Design §5 marks badges P1/future); the API
  lists whatever is in `user_badges`.
- Helpful-vote EXP (`+5`, P1).
- Live DB proof (no schema change; local Docker unavailable).

## Non-Goals

- Schema migration (uses existing columns).
- Seeding non-Newbie rank_definitions rows (ladder lives in code constants).
- Leaderboards, EXP history endpoint, or badge-award triggers.
- Client/mobile UI.
