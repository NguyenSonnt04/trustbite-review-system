import { describe, expect, it } from 'vitest';

import { resolveRank } from '../../../src/services/gamificationCalculator.js';
import { getGamificationRules } from '../../../src/config/gamificationRules.js';

const RULES = getGamificationRules();

describe('resolveRank — Gamification_Design §3 ladder', () => {
  it('starts a new user at NEWBIE with APPRENTICE as the next level', () => {
    const { level, nextLevel } = resolveRank(0, 0, RULES);
    expect(level.code).toBe('NEWBIE');
    expect(nextLevel).toMatchObject({ code: 'APPRENTICE', expToNext: 100, verifiedReviewsToNext: 2 });
  });

  it('stays NEWBIE below the APPRENTICE EXP threshold', () => {
    const { level, nextLevel } = resolveRank(99, 5, RULES);
    expect(level.code).toBe('NEWBIE');
    expect(nextLevel.expToNext).toBe(1);
    expect(nextLevel.verifiedReviewsToNext).toBe(0);
  });

  it('promotes to APPRENTICE when both EXP and verified-review conditions are met', () => {
    const { level, nextLevel } = resolveRank(100, 2, RULES);
    expect(level.code).toBe('APPRENTICE');
    expect(nextLevel).toMatchObject({ code: 'FOODIE', expToNext: 400, verifiedReviewsToNext: 8 });
  });

  it('does not promote on EXP alone when the verified-review condition is unmet', () => {
    const { level, nextLevel } = resolveRank(100, 1, RULES);
    expect(level.code).toBe('NEWBIE');
    expect(nextLevel).toMatchObject({ code: 'APPRENTICE', expToNext: 0, verifiedReviewsToNext: 1 });
  });

  it('caps at the highest satisfied tier when a higher tier needs more verified reviews', () => {
    // exp well past FOODIE's 500 but only 3 verified reviews (< 10).
    const { level, nextLevel } = resolveRank(600, 3, RULES);
    expect(level.code).toBe('APPRENTICE');
    expect(nextLevel).toMatchObject({ code: 'FOODIE', expToNext: 0, verifiedReviewsToNext: 7 });
  });

  it('reaches TRUSTED_FOODIE with no next level', () => {
    const { level, nextLevel } = resolveRank(2000, 25, RULES);
    expect(level.code).toBe('TRUSTED_FOODIE');
    expect(nextLevel).toBeNull();
  });

  it('keeps the top level for very high values', () => {
    expect(resolveRank(5000, 100, RULES).level.code).toBe('TRUSTED_FOODIE');
  });

  it('treats non-finite inputs as zero', () => {
    const { level } = resolveRank(Number.NaN, undefined, RULES);
    expect(level.code).toBe('NEWBIE');
  });

  it('accepts the shipped ladder (monotonic non-decreasing)', () => {
    expect(() => resolveRank(0, 0, RULES)).not.toThrow();
  });

  it('throws when a future ladder breaks the monotonic invariant', () => {
    const badRules = {
      rankLadder: [
        { code: 'NEWBIE', label: 'Newbie', minExp: 0, minVerifiedReviews: 0 },
        { code: 'FOODIE', label: 'Foodie', minExp: 500, minVerifiedReviews: 10 },
        // Regression: higher tier needs FEWER verified reviews than the one below.
        { code: 'BROKEN', label: 'Broken', minExp: 2000, minVerifiedReviews: 5 },
      ],
    };
    expect(() => resolveRank(3000, 10, badRules)).toThrow(/non-decreasing/i);
  });
});
