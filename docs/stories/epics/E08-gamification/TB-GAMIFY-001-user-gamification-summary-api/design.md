# Design

## Domain Model

Gamification summary for a user:

- `exp_points` (persisted on `users`).
- verified review count = `COUNT(reviews WHERE user_id AND status = 'VERIFIED')`.
- level/next level derived from the rank ladder (Gamification_Design §3).
- badges from `user_badges` JOIN `badge_definitions`.

Rank ladder + EXP values live in `gamificationRules.js` (frozen constants,
Decision 0014 pattern). The ladder is the code source of truth because
`rank_definitions` currently seeds only NEWBIE.

## Application Flow

Pure + read-service split:

- `gamificationCalculator.js` (pure): `resolveRank(expPoints, verifiedReviewCount,
  rules)` → `{ level, nextLevel }`. A tier is reached when EXP and verified-review
  thresholds are both met; since both are monotonic, the highest satisfied tier is
  the current level and the tier above is `nextLevel` (with `expToNext` /
  `verifiedReviewsToNext`), `null` at the top.
- `gamificationService.js`: `getUserGamification(userId)` loads the user
  (404 if missing, 403 if suspended/deleted), the verified review count, and the
  badges, then composes the DTO using `resolveRank`.

## Interface Contract

`GET /api/v1/users/me/gamification` (auth required, `authMiddleware`).

Response `200`:

```json
{
  "expPoints": 120,
  "verifiedReviewCount": 2,
  "level": { "code": "APPRENTICE", "label": "Apprentice", "minExp": 100, "minVerifiedReviews": 2 },
  "nextLevel": { "code": "FOODIE", "label": "Foodie", "minExp": 500, "minVerifiedReviews": 10, "expToNext": 380, "verifiedReviewsToNext": 8 },
  "badges": [
    { "code": "RECEIPT_MASTER", "label": "Receipt Master", "iconUrl": "...", "category": "ACHIEVEMENT", "awardedAt": "..." }
  ]
}
```

Errors: `404 USER_NOT_FOUND`, `403 ACCOUNT_SUSPENDED`, `403 ACCOUNT_DELETED`
(plus the shared auth errors from `authMiddleware`). `nextLevel` is `null` at the
top tier.

## Data Model

No migration. Reads `users.exp_points`/`status`, `reviews.status`,
`user_badges` + `badge_definitions`. No writes.

## UI / Platform Impact

None (backend contract only). Mobile profile/badges screens consume it later.

## Observability

No audit rows (read-only).

## Alternatives Considered

1. Return the persisted `users.rank_code` as the level — rejected: no writer
   maintains it yet, so it would always be NEWBIE. The derived level from
   exp + verified count is correct today and matches the ladder.
2. Seed non-Newbie `rank_definitions` rows now — rejected: that is a data
   migration; the ladder lives in code constants until a gamification write slice
   needs the seeded rows.
3. Include EXP awarding in this slice — deferred: awarding wires into review
   submit / verification decision (tested paths) and is a separate write slice;
   the read API + domain rules stand on their own.
