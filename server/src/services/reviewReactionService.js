import { pool } from '../config/db.js';
import { createHttpError } from '../utils/httpErrors.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REACTION_TYPES = new Set(['LOVE', 'HAHA', 'ANGRY']);

function assertUuid(value, field) {
  if (typeof value !== 'string' || !UUID_REGEX.test(value)) {
    throw createHttpError(422, 'VALIDATION_ERROR', `${field} must be a valid UUID`);
  }
}

export function parseReactionType(value) {
  if (typeof value !== 'string' || !REACTION_TYPES.has(value)) {
    throw createHttpError(
      422,
      'VALIDATION_ERROR',
      'reactionType must be one of LOVE, HAHA, ANGRY',
    );
  }
  return value;
}

async function lockPublicReview(client, reviewId) {
  const result = await client.query(
    `SELECT r.id
       FROM reviews r
       JOIN restaurants restaurant ON restaurant.id = r.restaurant_id
      WHERE r.id = $1
        AND r.status IN ('VERIFIED', 'REFERENCE_ONLY')
        AND r.public_visibility = 'PUBLIC'
        AND restaurant.status = 'ACTIVE'
        AND restaurant.is_deleted = false
      FOR SHARE OF r, restaurant`,
    [reviewId],
  );

  if (result.rowCount === 0) {
    throw createHttpError(404, 'NOT_FOUND', 'Review not found.');
  }
}

async function loadReactionCounts(client, reviewId) {
  const result = await client.query(
    `SELECT
       COUNT(*) FILTER (WHERE reaction_type = 'LOVE')::int AS "LOVE",
       COUNT(*) FILTER (WHERE reaction_type = 'HAHA')::int AS "HAHA",
       COUNT(*) FILTER (WHERE reaction_type = 'ANGRY')::int AS "ANGRY"
     FROM review_reactions
     WHERE review_id = $1`,
    [reviewId],
  );
  const row = result.rows[0] ?? {};
  return {
    LOVE: Number(row.LOVE ?? 0),
    HAHA: Number(row.HAHA ?? 0),
    ANGRY: Number(row.ANGRY ?? 0),
  };
}

async function mutateReviewReaction({
  userId,
  reviewId,
  reactionType,
  remove,
}) {
  assertUuid(userId, 'userId');
  assertUuid(reviewId, 'reviewId');
  if (!remove) parseReactionType(reactionType);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await lockPublicReview(client, reviewId);

    if (remove) {
      await client.query(
        `DELETE FROM review_reactions
         WHERE review_id = $1 AND user_id = $2`,
        [reviewId, userId],
      );
    } else {
      await client.query(
        `INSERT INTO review_reactions (review_id, user_id, reaction_type)
         VALUES ($1, $2, $3)
         ON CONFLICT (review_id, user_id)
         DO UPDATE SET
           reaction_type = EXCLUDED.reaction_type,
           updated_at = now()`,
        [reviewId, userId, reactionType],
      );
    }

    const reactionCounts = await loadReactionCounts(client, reviewId);
    await client.query('COMMIT');
    return {
      reviewId,
      myReaction: remove ? null : reactionType,
      reactionCounts,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function setReviewReaction({ userId, reviewId, reactionType }) {
  return mutateReviewReaction({
    userId,
    reviewId,
    reactionType,
    remove: false,
  });
}

export function deleteReviewReaction({ userId, reviewId }) {
  return mutateReviewReaction({
    userId,
    reviewId,
    reactionType: null,
    remove: true,
  });
}
