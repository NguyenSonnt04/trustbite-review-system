/**
 * trustScoreRules.js
 * Single source of truth for restaurant trust-score weights (Anti-Fraud §10,
 * Status_Mapping §2: "Trust score chỉ tính theo trustWeightBucket").
 *
 * Mirrors the fraudRules.js pattern (Decision 0014): weights ship as frozen
 * constants exposed through getTrustScoreRules(). The pure calculator receives
 * the returned object as a parameter; it never reads env or the DB directly.
 *
 * RestTrustScore = sum(Rating_i * weight_i) / sum(weight_i), where:
 *  - HIGH bucket (VERIFIED review): weight by reviewer rank,
 *  - LOW bucket (REFERENCE_ONLY review): reference weight,
 *  - NONE bucket (hidden/rejected/deleted/pending): excluded.
 */

const TRUST_SCORE_RULES = Object.freeze({
  // Reference (LOW bucket) review weight (§10).
  referenceWeight: 0.1,

  // Verified (HIGH bucket) review weights keyed by reviewer rank_code (§10).
  verifiedRankWeights: Object.freeze({
    NEWBIE: 0.5,
    APPRENTICE: 0.8,
    FOODIE: 1.0,
    TRUSTED_FOODIE: 1.5,
  }),

  // Fallback weight for a verified review whose rank_code is unknown/unseeded.
  // Defaults conservatively to the Newbie level.
  defaultVerifiedWeight: 0.5,

  // Score bounds and neutral default (restaurants.trust_score is NUMERIC(3,2)
  // CHECK BETWEEN 1.00 AND 5.00 with DEFAULT 5.00).
  minTrustScore: 1.0,
  maxTrustScore: 5.0,
  defaultTrustScore: 5.0, // no qualifying (HIGH/LOW) reviews → neutral default
});

export function getTrustScoreRules() {
  return TRUST_SCORE_RULES;
}
