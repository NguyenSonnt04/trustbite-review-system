import { pool } from '../config/db.js';
import { createHttpError } from '../utils/httpErrors.js';

/**
 * userBlockService — user-to-user block/unblock within TrustBite community scope.
 *
 * Contract source: API_Specification.md §7, Functional_Specification.md SAFETY-001,
 * Business_Rules.md BR-SAFE-003. A block is only a relationship between two users;
 * it never changes the target's account status (that is admin suspend, BR-ADM-006).
 *
 * Input parsing/validation happens at the HTTP boundary (controllers/userBlock.js).
 * This service receives well-formed values and owns business rules + persistence.
 *
 * Schema note (001_init_schema.sql): user_blocks has UNIQUE(blocker_user_id,
 * blocked_user_id) that ignores deleted_at, plus a soft-delete column. A re-block
 * after unblock must reactivate the existing row, never insert a second one.
 */

/**
 * Map raw persistence errors to stable HTTP contract errors. HttpErrors we threw
 * intentionally pass through unchanged; Postgres constraint codes guard races and
 * bad references so a broken invariant never surfaces as a bare 500.
 */
function mapDbError(err) {
  if (err && typeof err.statusCode === 'number') {
    return err;
  }
  if (err && err.code === '23505') {
    return createHttpError(409, 'USER_ALREADY_BLOCKED', 'User is already blocked');
  }
  if (err && err.code === '23514') {
    return createHttpError(400, 'CANNOT_BLOCK_SELF', 'Users cannot block themselves');
  }
  if (err && err.code === '23503') {
    const constraint = String(err.constraint || '');
    if (constraint.includes('source_review_id')) {
      return createHttpError(422, 'VALIDATION_ERROR', 'sourceReviewId does not reference an existing review');
    }
    if (constraint.includes('blocked_user_id')) {
      return createHttpError(404, 'NOT_FOUND', 'Target user not found');
    }
  }
  if (err && err.code === '22P02') {
    return createHttpError(422, 'VALIDATION_ERROR', 'Invalid identifier format');
  }
  return err;
}

/**
 * Roll back without masking the original failure. If the connection is already
 * broken, the ROLLBACK itself throws; swallowing that keeps the real cause.
 */
async function safeRollback(client) {
  try {
    await client.query('ROLLBACK');
  } catch {
    // Intentionally ignored: preserve the original error for the caller.
  }
}

async function blockUserWithClient(
  client,
  blockerUserId,
  targetUserId,
  { reasonCode = null, sourceReviewId = null } = {},
) {
  if (blockerUserId === targetUserId) {
    throw createHttpError(400, 'CANNOT_BLOCK_SELF', 'Users cannot block themselves');
  }

  const target = await client.query('SELECT id FROM users WHERE id = $1', [targetUserId]);
  if (target.rowCount === 0) {
    throw createHttpError(404, 'NOT_FOUND', 'Target user not found');
  }

  const existing = await client.query(
    'SELECT id, deleted_at FROM user_blocks WHERE blocker_user_id = $1 AND blocked_user_id = $2 FOR UPDATE',
    [blockerUserId, targetUserId],
  );

  let row;
  if (existing.rowCount > 0) {
    if (existing.rows[0].deleted_at === null) {
      throw createHttpError(409, 'USER_ALREADY_BLOCKED', 'User is already blocked');
    }
    const reactivated = await client.query(
      `UPDATE user_blocks
       SET deleted_at = NULL, reason_code = $2, source_review_id = $3, created_at = now()
       WHERE id = $1
       RETURNING blocked_user_id, created_at`,
      [existing.rows[0].id, reasonCode, sourceReviewId],
    );
    row = reactivated.rows[0];
  } else {
    const inserted = await client.query(
      `INSERT INTO user_blocks (blocker_user_id, blocked_user_id, reason_code, source_review_id)
       VALUES ($1, $2, $3, $4)
       RETURNING blocked_user_id, created_at`,
      [blockerUserId, targetUserId, reasonCode, sourceReviewId],
    );
    row = inserted.rows[0];
  }

  return { blockedUserId: row.blocked_user_id, blockedAt: row.created_at };
}

export async function blockUser(blockerUserId, targetUserId, options = {}) {
  if (blockerUserId === targetUserId) {
    throw createHttpError(400, 'CANNOT_BLOCK_SELF', 'Users cannot block themselves');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await blockUserWithClient(client, blockerUserId, targetUserId, options);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await safeRollback(client);
    throw mapDbError(err);
  } finally {
    client.release();
  }
}

export async function unblockUser(blockerUserId, targetUserId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE user_blocks
       SET deleted_at = now()
       WHERE blocker_user_id = $1 AND blocked_user_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [blockerUserId, targetUserId]
    );

    if (result.rowCount === 0) {
      throw createHttpError(404, 'NOT_FOUND', 'Active block not found');
    }

    await client.query('COMMIT');
    return { success: true };
  } catch (err) {
    await safeRollback(client);
    throw mapDbError(err);
  } finally {
    client.release();
  }
}

async function resolvePublicReviewAuthor(client, reviewId) {
  const result = await client.query(
    `SELECT review.user_id
     FROM reviews review
     JOIN restaurants restaurant ON restaurant.id = review.restaurant_id
     WHERE review.id = $1
       AND review.status IN ('VERIFIED', 'REFERENCE_ONLY')
       AND review.public_visibility = 'PUBLIC'
       AND restaurant.status = 'ACTIVE'
       AND restaurant.is_deleted = FALSE
     FOR SHARE OF review, restaurant`,
    [reviewId],
  );

  if (result.rowCount === 0) {
    throw createHttpError(404, 'NOT_FOUND', 'Review not found');
  }

  return result.rows[0].user_id;
}

export async function blockReviewAuthor(blockerUserId, reviewId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const authorUserId = await resolvePublicReviewAuthor(client, reviewId);
    const result = await blockUserWithClient(client, blockerUserId, authorUserId, {
      sourceReviewId: reviewId,
    });
    await client.query('COMMIT');
    return {
      success: true,
      blockedAt: result.blockedAt,
    };
  } catch (err) {
    await safeRollback(client);
    throw mapDbError(err);
  } finally {
    client.release();
  }
}

export async function unblockReviewAuthor(blockerUserId, reviewId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE user_blocks
       SET deleted_at = now()
       FROM reviews review
       WHERE review.id = $2
         AND user_blocks.blocker_user_id = $1
         AND user_blocks.blocked_user_id = review.user_id
         AND user_blocks.deleted_at IS NULL
       RETURNING user_blocks.id`,
      [blockerUserId, reviewId],
    );

    if (result.rowCount === 0) {
      throw createHttpError(404, 'NOT_FOUND', 'Active block not found');
    }

    await client.query('COMMIT');
    return { success: true };
  } catch (err) {
    await safeRollback(client);
    throw mapDbError(err);
  } finally {
    client.release();
  }
}
