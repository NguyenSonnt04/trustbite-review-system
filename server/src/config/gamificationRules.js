/**
 * gamificationRules.js
 * Single source of truth for EXP values and the rank ladder
 * (Gamification_Design §2, §3). Frozen constants exposed through
 * getGamificationRules() (Decision 0014 pattern); pure functions receive the
 * returned object as a parameter and never read env or the DB directly.
 *
 * The rank ladder lives here because rank_definitions currently seeds only
 * NEWBIE; the ladder is the code source of truth for level/progress until the
 * non-Newbie rank rows are seeded.
 */

const GAMIFICATION_RULES = Object.freeze({
  // EXP award values (§2). Awarding is a separate write slice; these constants
  // are shared so the awarder and any display stay consistent.
  exp: Object.freeze({
    referenceReview: 10, // valid reference review
    verifiedReview: 50, // review verified by receipt/risk/admin
    helpfulVote: 5, // P1
    dailyReferenceExpCap: 2, // at most 2 reference reviews/day earn EXP
  }),

  // Rank ladder (§3), ascending. Each level requires BOTH the EXP threshold and
  // the verified-review count. FOODGOD is intentionally excluded (future/secret).
  rankLadder: Object.freeze([
    Object.freeze({ code: 'NEWBIE', label: 'Newbie', minExp: 0, minVerifiedReviews: 0 }),
    Object.freeze({ code: 'APPRENTICE', label: 'Apprentice', minExp: 100, minVerifiedReviews: 2 }),
    Object.freeze({ code: 'FOODIE', label: 'Foodie', minExp: 500, minVerifiedReviews: 10 }),
    Object.freeze({ code: 'TRUSTED_FOODIE', label: 'Trusted Foodie', minExp: 2000, minVerifiedReviews: 25 }),
  ]),
});

export function getGamificationRules() {
  return GAMIFICATION_RULES;
}
