/**
 * trustScoreCalculator.js
 * Pure, DB-free restaurant trust-score computation (Anti-Fraud §10,
 * Status_Mapping §2/§3).
 *
 * The function takes all inputs as parameters (including the rules object from
 * getTrustScoreRules()) and has no side effects, so it is exhaustively unit
 * testable against the spec's weighting table and the zero-review default.
 */

/** Round to 2 decimals for the NUMERIC(3,2) trust_score column. */
function round2(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Weight for a single review based on its trust weight bucket and (for verified
 * reviews) the reviewer rank.
 *
 * @param {'HIGH'|'LOW'|'NONE'|string} bucket - reviews.trust_weight_bucket
 * @param {string|null} rankCode - reviewer users.rank_code (verified only)
 * @param {object} rules - from getTrustScoreRules()
 * @returns {number} weight (0 when the review does not contribute)
 */
export function weightForReview(bucket, rankCode, rules) {
  if (bucket === 'HIGH') {
    return rules.verifiedRankWeights[rankCode] ?? rules.defaultVerifiedWeight;
  }
  if (bucket === 'LOW') {
    return rules.referenceWeight;
  }
  return 0; // NONE / unknown buckets do not contribute (§10 hidden/rejected/deleted)
}

/**
 * Compute a restaurant trust score and verified/reference review counts from its
 * reviews (§10). Reviews with a NONE bucket are ignored.
 *
 * @param {Array<{averageRating: number|string|null, trustWeightBucket: string, rankCode: string|null}>} reviews
 * @param {object} rules - from getTrustScoreRules()
 * @returns {{trustScore: number, verifiedReviewCount: number, referenceReviewCount: number}}
 */
export function computeTrustScore(reviews, rules) {
  let sumWeighted = 0;
  let sumWeights = 0;
  let verifiedReviewCount = 0;
  let referenceReviewCount = 0;

  for (const review of reviews ?? []) {
    const bucket = review.trustWeightBucket;
    if (bucket === 'HIGH') verifiedReviewCount += 1;
    else if (bucket === 'LOW') referenceReviewCount += 1;

    const weight = weightForReview(bucket, review.rankCode, rules);
    if (weight <= 0) continue;

    const rating = review.averageRating != null ? Number(review.averageRating) : null;
    if (rating == null || Number.isNaN(rating)) continue;

    sumWeighted += rating * weight;
    sumWeights += weight;
  }

  let trustScore;
  if (sumWeights === 0) {
    trustScore = rules.defaultTrustScore;
  } else {
    const raw = sumWeighted / sumWeights;
    const clamped = Math.min(rules.maxTrustScore, Math.max(rules.minTrustScore, raw));
    trustScore = round2(clamped);
  }

  return { trustScore, verifiedReviewCount, referenceReviewCount };
}
