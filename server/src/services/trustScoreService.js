/**
 * trustScoreService.js
 * Recomputes and persists a restaurant's trust score + verified/reference review
 * counts from its reviews (Anti-Fraud §10, Status_Mapping §2/§3). Backend is the
 * source of truth; the client never computes trust score.
 *
 * All raw DB access lives here; the pure math is in trustScoreCalculator.js. The
 * function can either open its own transaction or join a caller-provided client,
 * so a verification/admin/deletion flow can recompute inside its own transaction.
 *
 * Only columns present in 001_init_schema.sql are read/written:
 *  reviews.average_rating, reviews.trust_weight_bucket, users.rank_code,
 *  restaurants.trust_score / verified_review_count / reference_review_count.
 */

import { pool } from '../config/db.js';
import { getTrustScoreRules } from '../config/trustScoreRules.js';
import { computeTrustScore } from './trustScoreCalculator.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
    this.code = 'NOT_FOUND';
  }
}

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 422;
    this.code = 'VALIDATION_ERROR';
  }
}

// Only verified/reference buckets contribute. FULL/PARTIAL are legacy persisted
// aliases for HIGH/LOW; NONE (hidden/rejected/deleted/pending) stays excluded.
const LOAD_REVIEWS_SQL = `
  SELECT r.average_rating AS "averageRating",
         CASE r.trust_weight_bucket
           WHEN 'FULL' THEN 'HIGH'
           WHEN 'PARTIAL' THEN 'LOW'
           ELSE r.trust_weight_bucket
         END AS "trustWeightBucket",
         u.rank_code AS "rankCode"
  FROM reviews r
  JOIN users u ON u.id = r.user_id
  WHERE r.restaurant_id = $1
    AND r.status IN ('VERIFIED', 'REFERENCE_ONLY')
    AND r.public_visibility = 'PUBLIC'
    AND r.trust_weight_bucket IN ('HIGH', 'LOW', 'FULL', 'PARTIAL')
`;

const LOCK_RESTAURANT_SQL = `
  SELECT 1
  FROM restaurants
  WHERE id = $1
  FOR UPDATE
`;

const UPDATE_RESTAURANT_SQL = `
  UPDATE restaurants
  SET trust_score = $2,
      verified_review_count = $3,
      reference_review_count = $4,
      updated_at = NOW()
  WHERE id = $1
  RETURNING id
`;

/**
 * Recompute and persist trust_score + review counts for one restaurant.
 *
 * @param {string} restaurantId - UUID of the restaurant.
 * @param {object} [opts]
 * @param {object} [opts.client] - existing pg client to join a caller transaction.
 *   When omitted, the function opens and commits its own transaction.
 * @returns {Promise<{trustScore: number, verifiedReviewCount: number, referenceReviewCount: number}>}
 */
export async function recomputeRestaurantTrustScore(restaurantId, { client } = {}) {
  if (typeof restaurantId !== 'string' || !UUID_REGEX.test(restaurantId)) {
    throw new ValidationError('restaurantId must be a valid UUID.');
  }

  const rules = getTrustScoreRules();
  const ownsTransaction = !client;
  const db = client ?? await pool.connect();

  try {
    if (ownsTransaction) await db.query('BEGIN');

    // Serialize recomputes for one restaurant before taking the aggregate
    // snapshot so a waiter sees review changes committed by the lock holder.
    await db.query(LOCK_RESTAURANT_SQL, [restaurantId]);
    const reviewsResult = await db.query(LOAD_REVIEWS_SQL, [restaurantId]);
    const result = computeTrustScore(reviewsResult.rows, rules);

    const updateResult = await db.query(UPDATE_RESTAURANT_SQL, [
      restaurantId,
      result.trustScore,
      result.verifiedReviewCount,
      result.referenceReviewCount,
    ]);

    if (updateResult.rowCount === 0) {
      throw new NotFoundError('Restaurant not found.');
    }

    if (ownsTransaction) await db.query('COMMIT');
    return result;
  } catch (err) {
    if (ownsTransaction) await db.query('ROLLBACK');
    throw err;
  } finally {
    if (ownsTransaction) db.release();
  }
}
