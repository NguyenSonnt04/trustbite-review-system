import { describe, expect, it } from 'vitest';

import { computeTrustScore, weightForReview } from '../../../src/services/trustScoreCalculator.js';
import { getTrustScoreRules } from '../../../src/config/trustScoreRules.js';

const RULES = getTrustScoreRules();

const review = (trustWeightBucket, averageRating, rankCode = 'NEWBIE') => ({
  trustWeightBucket,
  averageRating,
  rankCode,
});

describe('weightForReview — Anti-Fraud §10 weights', () => {
  it('weights verified reviews by reviewer rank', () => {
    expect(weightForReview('HIGH', 'NEWBIE', RULES)).toBe(0.5);
    expect(weightForReview('HIGH', 'APPRENTICE', RULES)).toBe(0.8);
    expect(weightForReview('HIGH', 'FOODIE', RULES)).toBe(1.0);
    expect(weightForReview('HIGH', 'TRUSTED_FOODIE', RULES)).toBe(1.5);
  });

  it('falls back to the Newbie-level weight for an unknown/unseeded rank', () => {
    expect(weightForReview('HIGH', 'MYSTERY_RANK', RULES)).toBe(0.5);
    expect(weightForReview('HIGH', null, RULES)).toBe(0.5);
  });

  it('weights reference (LOW) reviews at 0.1 regardless of rank', () => {
    expect(weightForReview('LOW', 'TRUSTED_FOODIE', RULES)).toBe(0.1);
  });

  it('gives NONE / unknown buckets zero weight', () => {
    expect(weightForReview('NONE', 'FOODIE', RULES)).toBe(0);
    expect(weightForReview(undefined, 'FOODIE', RULES)).toBe(0);
  });
});

describe('computeTrustScore — Anti-Fraud §10 aggregate', () => {
  it('returns the neutral default with no qualifying reviews', () => {
    expect(computeTrustScore([], RULES)).toEqual({
      trustScore: 5.0,
      verifiedReviewCount: 0,
      referenceReviewCount: 0,
    });
    expect(computeTrustScore(null, RULES).trustScore).toBe(5.0);
  });

  it('excludes NONE-bucket reviews entirely (hidden/rejected/deleted/pending)', () => {
    const result = computeTrustScore(
      [review('NONE', 1), review('NONE', 5)],
      RULES,
    );
    expect(result).toEqual({ trustScore: 5.0, verifiedReviewCount: 0, referenceReviewCount: 0 });
  });

  it('uses the rating directly for a single verified review', () => {
    const result = computeTrustScore([review('HIGH', 4, 'NEWBIE')], RULES);
    expect(result.trustScore).toBe(4.0);
    expect(result.verifiedReviewCount).toBe(1);
    expect(result.referenceReviewCount).toBe(0);
  });

  it('uses the rating directly for a single reference review', () => {
    const result = computeTrustScore([review('LOW', 3)], RULES);
    expect(result.trustScore).toBe(3.0);
    expect(result.referenceReviewCount).toBe(1);
    expect(result.verifiedReviewCount).toBe(0);
  });

  it('weights higher-rank verified reviews more heavily', () => {
    // FOODIE(1.0) rating 5 + NEWBIE(0.5) rating 1 → (5 + 0.5) / 1.5 = 3.666… → 3.67
    const result = computeTrustScore(
      [review('HIGH', 5, 'FOODIE'), review('HIGH', 1, 'NEWBIE')],
      RULES,
    );
    expect(result.trustScore).toBe(3.67);
    expect(result.verifiedReviewCount).toBe(2);
  });

  it('down-weights reference reviews against verified reviews', () => {
    // FOODIE verified(1.0) rating 5 + reference(0.1) rating 1 → (5 + 0.1) / 1.1 = 4.636… → 4.64
    const result = computeTrustScore(
      [review('HIGH', 5, 'FOODIE'), review('LOW', 1)],
      RULES,
    );
    expect(result.trustScore).toBe(4.64);
    expect(result.verifiedReviewCount).toBe(1);
    expect(result.referenceReviewCount).toBe(1);
  });

  it('parses NUMERIC ratings delivered as strings by pg', () => {
    const result = computeTrustScore([review('HIGH', '4.50', 'FOODIE')], RULES);
    expect(result.trustScore).toBe(4.5);
  });

  it('counts a verified review with a missing rating but excludes it from the math', () => {
    const result = computeTrustScore(
      [review('HIGH', null, 'NEWBIE'), review('HIGH', 4, 'NEWBIE')],
      RULES,
    );
    expect(result.trustScore).toBe(4.0); // only the valid rating contributes
    expect(result.verifiedReviewCount).toBe(2);
  });

  it('keeps the score within the 1.00–5.00 bounds', () => {
    const result = computeTrustScore(
      [review('HIGH', 5, 'TRUSTED_FOODIE'), review('LOW', 5)],
      RULES,
    );
    expect(result.trustScore).toBeGreaterThanOrEqual(RULES.minTrustScore);
    expect(result.trustScore).toBeLessThanOrEqual(RULES.maxTrustScore);
  });
});
