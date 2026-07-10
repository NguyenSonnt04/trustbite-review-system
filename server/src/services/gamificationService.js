/**
 * gamificationService.js
 * Read model for the authenticated user's gamification summary (points, level,
 * progress, badges) — Gamification_Design §2, §3.
 *
 * Backend is the source of truth. The level is derived from the persisted
 * exp_points + verified review count via the rank ladder, so it stays correct
 * regardless of whether users.rank_code has been reconciled by a writer yet.
 *
 * Read-only. Only columns present in 001_init_schema.sql are read. EXP awarding
 * and rank_code persistence are a separate write slice.
 */

import { pool } from '../config/db.js';
import { createHttpError } from '../utils/httpErrors.js';
import { getGamificationRules } from '../config/gamificationRules.js';
import { resolveRank } from './gamificationCalculator.js';

function mapBadgeRow(row) {
  return {
    code: row.code,
    label: row.label,
    iconUrl: row.icon_url,
    category: row.category,
    awardedAt: row.awarded_at,
  };
}

/**
 * Build the gamification summary for one user.
 *
 * @param {string} userId - authenticated user id.
 * @returns {Promise<object>} { expPoints, verifiedReviewCount, level, nextLevel, badges }
 */
export async function getUserGamification(userId) {
  const rules = getGamificationRules();

  const userResult = await pool.query(
    `SELECT id, status, exp_points, rank_code FROM users WHERE id = $1`,
    [userId],
  );
  if (userResult.rowCount === 0) {
    throw createHttpError(404, 'USER_NOT_FOUND', 'User not found.');
  }
  const user = userResult.rows[0];
  if (user.status === 'SUSPENDED') {
    throw createHttpError(403, 'ACCOUNT_SUSPENDED', 'Account is suspended.');
  }
  if (user.status === 'DELETED') {
    throw createHttpError(403, 'ACCOUNT_DELETED', 'Account is deleted.');
  }

  const verifiedResult = await pool.query(
    `SELECT COUNT(*)::int AS count FROM reviews WHERE user_id = $1 AND status = 'VERIFIED'`,
    [userId],
  );
  const verifiedReviewCount = verifiedResult.rows[0]?.count ?? 0;

  const badgesResult = await pool.query(
    `SELECT b.code, b.label, b.icon_url, b.category, ub.awarded_at
     FROM user_badges ub
     JOIN badge_definitions b ON b.code = ub.badge_code
     WHERE ub.user_id = $1
     ORDER BY ub.awarded_at ASC`,
    [userId],
  );

  const expPoints = user.exp_points ?? 0;
  const { level, nextLevel } = resolveRank(expPoints, verifiedReviewCount, rules);

  return {
    expPoints,
    verifiedReviewCount,
    level,
    nextLevel,
    badges: badgesResult.rows.map(mapBadgeRow),
  };
}
