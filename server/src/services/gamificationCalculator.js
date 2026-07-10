/**
 * gamificationCalculator.js
 * Pure, DB-free rank/level resolution (Gamification_Design §3).
 *
 * A level is reached when BOTH its EXP threshold and its verified-review count
 * are met. Because both thresholds increase monotonically up the ladder, the set
 * of satisfied levels is a prefix, so the current level is the highest satisfied
 * one and the next level is the entry immediately above it.
 *
 * The prefix/`break` logic below depends on that monotonic invariant. If a future
 * ladder edit made a higher tier require FEWER EXP or verified reviews than a
 * lower tier, the loop could stop early and skip a genuinely-satisfied tier.
 * assertMonotonicLadder() enforces the invariant and fails loudly instead.
 */

/**
 * Guard the ladder invariant relied on by resolveRank: minExp and
 * minVerifiedReviews must be non-decreasing from one tier to the next.
 * @param {Array<{code: string, minExp: number, minVerifiedReviews: number}>} ladder
 */
function assertMonotonicLadder(ladder) {
  for (let i = 1; i < ladder.length; i += 1) {
    if (ladder[i].minExp < ladder[i - 1].minExp
      || ladder[i].minVerifiedReviews < ladder[i - 1].minVerifiedReviews) {
      throw new Error(
        `Gamification rank ladder must be non-decreasing in minExp and minVerifiedReviews; `
        + `'${ladder[i].code}' violates the invariant after '${ladder[i - 1].code}'.`,
      );
    }
  }
}

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
  assertMonotonicLadder(ladder);

  let currentIndex = 0;
  for (let i = 0; i < ladder.length; i += 1) {
    const tier = ladder[i];
    if (exp >= tier.minExp && verified >= tier.minVerifiedReviews) {
      currentIndex = i;
    } else {
      // Monotonic invariant (asserted above): once a tier is unmet, no higher
      // tier can be satisfied, so the current level is the last satisfied one.
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
