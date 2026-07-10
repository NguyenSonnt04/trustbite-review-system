/**
 * gamificationCalculator.js
 * Pure, DB-free rank/level resolution (Gamification_Design §3).
 *
 * A level is reached when BOTH its EXP threshold and its verified-review count
 * are met. Because both thresholds increase monotonically up the ladder, the set
 * of satisfied levels is a prefix, so the current level is the highest satisfied
 * one and the next level is the entry immediately above it.
 */

/**
 * Resolve the current level and progress to the next level.
 *
 * @param {number} expPoints - user's EXP.
 * @param {number} verifiedReviewCount - user's verified review count.
 * @param {object} rules - from getGamificationRules().
 * @returns {{
 *   level: {code: string, label: string, minExp: number, minVerifiedReviews: number},
 *   nextLevel: null | {code: string, label: string, minExp: number, minVerifiedReviews: number,
 *                      expToNext: number, verifiedReviewsToNext: number}
 * }}
 */
export function resolveRank(expPoints, verifiedReviewCount, rules) {
  const exp = Number.isFinite(expPoints) ? expPoints : 0;
  const verified = Number.isFinite(verifiedReviewCount) ? verifiedReviewCount : 0;
  const ladder = rules.rankLadder;

  let currentIndex = 0;
  for (let i = 0; i < ladder.length; i += 1) {
    const tier = ladder[i];
    if (exp >= tier.minExp && verified >= tier.minVerifiedReviews) {
      currentIndex = i;
    } else {
      break;
    }
  }

  const current = ladder[currentIndex];
  const level = {
    code: current.code,
    label: current.label,
    minExp: current.minExp,
    minVerifiedReviews: current.minVerifiedReviews,
  };

  const upcoming = ladder[currentIndex + 1] ?? null;
  const nextLevel = upcoming
    ? {
        code: upcoming.code,
        label: upcoming.label,
        minExp: upcoming.minExp,
        minVerifiedReviews: upcoming.minVerifiedReviews,
        expToNext: Math.max(0, upcoming.minExp - exp),
        verifiedReviewsToNext: Math.max(0, upcoming.minVerifiedReviews - verified),
      }
    : null;

  return { level, nextLevel };
}
