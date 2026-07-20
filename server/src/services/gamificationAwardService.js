import { getGamificationRules } from '../config/gamificationRules.js';
import { resolveRank } from './gamificationCalculator.js';
import {
  createNotification,
  NOTIFICATION_TYPES,
} from './notificationService.js';
import { recomputeRestaurantTrustScore } from './trustScoreService.js';

const BADGES = Object.freeze({
  receiptMaster: 'RECEIPT_MASTER',
  explorer: 'EXPLORER',
});

async function hasReceiptMasterBadge(client, userId) {
  const result = await client.query(
    `SELECT status
     FROM reviews
     WHERE user_id = $1
       AND status IN ('VERIFIED', 'REFERENCE_ONLY', 'REJECTED')
     ORDER BY created_at DESC, id DESC
     LIMIT 10`,
    [userId],
  );

  return result.rows.length === 10
    && result.rows.every((row) => row.status === 'VERIFIED');
}

async function hasExplorerBadge(client, userId) {
  const result = await client.query(
    `SELECT COUNT(DISTINCT mine.restaurant_id)::int AS count
     FROM reviews mine
     JOIN receipt_verifications mine_receipt
       ON mine_receipt.review_id = mine.id
      AND mine_receipt.decision = 'VERIFIED'
     WHERE mine.user_id = $1
       AND mine.status = 'VERIFIED'
       AND NOT EXISTS (
         SELECT 1
         FROM reviews earlier
         JOIN receipt_verifications earlier_receipt
           ON earlier_receipt.review_id = earlier.id
          AND earlier_receipt.decision = 'VERIFIED'
         WHERE earlier.restaurant_id = mine.restaurant_id
           AND earlier.status = 'VERIFIED'
           AND (earlier_receipt.decided_at, earlier_receipt.id)
             < (mine_receipt.decided_at, mine_receipt.id)
       )`,
    [userId],
  );

  return (result.rows[0]?.count ?? 0) >= 5;
}

async function awardBadge(client, userId, badgeCode) {
  const result = await client.query(
    `WITH inserted AS (
       INSERT INTO user_badges (user_id, badge_code)
       SELECT $1, code
       FROM badge_definitions
       WHERE code = $2
       ON CONFLICT (user_id, badge_code) DO NOTHING
       RETURNING badge_code AS code, awarded_at AS "awardedAt"
     )
     SELECT inserted.code, inserted."awardedAt", badges.label
     FROM inserted
     JOIN badge_definitions badges ON badges.code = inserted.code`,
    [userId, badgeCode],
  );

  if (result.rows.length === 0) return null;
  return result.rows[0];
}

export async function awardVerifiedReview({
  client,
  userId,
  reviewId,
  restaurantId,
  notificationsEnabled = true,
}) {
  const rules = getGamificationRules();
  const userResult = await client.query(
    `SELECT exp_points, rank_code
     FROM users
     WHERE id = $1
     FOR UPDATE`,
    [userId],
  );

  if (userResult.rows.length === 0) {
    throw new Error('Cannot award gamification for a missing user.');
  }

  const awardResult = await client.query(
    `INSERT INTO exp_transactions (user_id, delta, reason, entity_type, entity_id)
     VALUES ($1, $2, 'REVIEW_VERIFIED', 'REVIEW', $3)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [userId, rules.exp.verifiedReview, reviewId],
  );

  if (awardResult.rows.length === 0) {
    return {
      expAwarded: 0,
      skipped: true,
      newlyAwardedBadges: [],
    };
  }

  const expAwarded = rules.exp.verifiedReview;
  await client.query(
    `UPDATE users
     SET exp_points = exp_points + $2
     WHERE id = $1`,
    [userId, expAwarded],
  );

  const impactedRestaurantResult = await client.query(
    `SELECT DISTINCT restaurant_id AS id
     FROM reviews
     WHERE user_id = $1
       AND trust_weight_bucket = 'HIGH'
     UNION
     SELECT $2::uuid AS id
     ORDER BY id`,
    [userId, restaurantId],
  );
  await client.query(
    `SELECT id
     FROM restaurants
     WHERE id = ANY($1::uuid[])
     ORDER BY id
     FOR UPDATE`,
    [impactedRestaurantResult.rows.map((row) => row.id)],
  );

  const expResult = await client.query(
    'SELECT exp_points FROM users WHERE id = $1',
    [userId],
  );
  const verifiedResult = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM reviews
     WHERE user_id = $1
       AND status = 'VERIFIED'`,
    [userId],
  );
  const expPoints = expResult.rows[0]?.exp_points ?? 0;
  const verifiedReviewCount = verifiedResult.rows[0]?.count ?? 0;
  const { level } = resolveRank(expPoints, verifiedReviewCount, rules);

  const rankResult = await client.query(
    `UPDATE users
     SET rank_code = $2
     WHERE id = $1
       AND rank_code IS DISTINCT FROM $2
     RETURNING rank_code`,
    [userId, level.code],
  );

  const newlyAwardedBadges = [];
  if (await hasReceiptMasterBadge(client, userId)) {
    const award = await awardBadge(client, userId, BADGES.receiptMaster);
    if (award) newlyAwardedBadges.push(award);
  }
  if (await hasExplorerBadge(client, userId)) {
    const award = await awardBadge(client, userId, BADGES.explorer);
    if (award) newlyAwardedBadges.push(award);
  }

  if (notificationsEnabled) {
    await createNotification(client, {
      recipientUserId: userId,
      type: NOTIFICATION_TYPES.reviewVerified,
      payload: { reviewId },
    });

    for (const badge of newlyAwardedBadges) {
      await createNotification(client, {
        recipientUserId: userId,
        type: NOTIFICATION_TYPES.badgeEarned,
        payload: {
          badgeCode: badge.code,
          badgeLabel: badge.label,
        },
      });
    }
  }

  const affectedRestaurantIds = new Set([restaurantId]);
  if (rankResult.rows.length > 0 && userResult.rows[0].rank_code !== level.code) {
    const affectedRestaurants = await client.query(
      `SELECT DISTINCT restaurant_id
       FROM reviews
       WHERE user_id = $1
         AND trust_weight_bucket = 'HIGH'
       ORDER BY restaurant_id`,
      [userId],
    );
    for (const row of affectedRestaurants.rows) {
      affectedRestaurantIds.add(row.restaurant_id);
    }
  }
  for (const affectedRestaurantId of affectedRestaurantIds) {
    await recomputeRestaurantTrustScore(affectedRestaurantId, { client });
  }

  return {
    expAwarded,
    skipped: false,
    expPoints,
    verifiedReviewCount,
    level,
    newlyAwardedBadges,
  };
}
