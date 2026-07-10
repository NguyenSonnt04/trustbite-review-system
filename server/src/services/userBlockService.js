import { pool } from '../config/db.js';
import { createHttpError } from '../utils/httpErrors.js';

/**
 * userBlockService — user-to-user block/unblock within TrustBite community scope.
 *
 * Contract source: API_Specification.md §7, Functional_Specification.md SAFETY-001,
 * Business_Rules.md BR-SAFE-003. A block is only a relationship between two users;
 * it never changes the target's account status (that is admin suspend, BR-ADM-006).
 *
 * Schema note (001_init_schema.sql): user_blocks has UNIQUE(blocker_user_id,
 * blocked_user_id) that ignores deleted_at, plus a soft-delete column. A re-block
 * after unblock must reactivate the existing row, never insert a second one.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REASON_CODE_MAX_LENGTH = 60;

function assertTargetUserId(value) {
  if (typeof value !== 'string' || !UUID_REGEX.test(value)) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'userId must be a valid UUID');
  }
}

function normalizeReasonCode(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw createHttpError(422, 'VALIDATION_ERROR', 'reasonCode must be a string');
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > REASON_CODE_MAX_LENGTH) {
    throw createHttpError(422, 'VALIDATION_ERROR', `reasonCode must be at most ${REASON_CODE_MAX_LENGTH} characters`);
  }
  return trimmed;
}

function normalizeSourceReviewId(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !UUID_REGEX.test(value)) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'sourceReviewId must be a valid UUID');
  }
  return value;
}

/**
 * Map raw persistence errors to stable HTTP contract errors. HttpErrors we threw
 * intentionally pass through unchanged; Postgres constraint codes guard races and
 * bad references.
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
  return err;
}

export async function blockUser(blockerUserId, targetUserId, body = {}) {
  assertTargetUserId(targetUserId);

  if (blockerUserId === targetUserId) {
    throw createHttpError(400, 'CANNOT_BLOCK_SELF', 'Users cannot block themselves');
  }

  const reasonCode = normalizeReasonCode(body.reasonCode);
  const sourceReviewId = normalizeSourceReviewId(body.sourceReviewId);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const target = await client.query('SELECT id FROM users WHERE id = $1', [targetUserId]);
    if (target.rowCount === 0) {
      throw createHttpError(404, 'NOT_FOUND', 'Target user not found');
    }

    const existing = await client.query(
      'SELECT id, deleted_at FROM user_blocks WHERE blocker_user_id = $1 AND blocked_user_id = $2 FOR UPDATE',
      [blockerUserId, targetUserId]
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
        [existing.rows[0].id, reasonCode, sourceReviewId]
      );
      row = reactivated.rows[0];
    } else {
      const inserted = await client.query(
        `INSERT INTO user_blocks (blocker_user_id, blocked_user_id, reason_code, source_review_id)
         VALUES ($1, $2, $3, $4)
         RETURNING blocked_user_id, created_at`,
        [blockerUserId, targetUserId, reasonCode, sourceReviewId]
      );
      row = inserted.rows[0];
    }

    await client.query('COMMIT');
    return { blockedUserId: row.blocked_user_id, blockedAt: row.created_at };
  } catch (err) {
    await client.query('ROLLBACK');
    throw mapDbError(err);
  } finally {
    client.release();
  }
}

export async function unblockUser(blockerUserId, targetUserId) {
  assertTargetUserId(targetUserId);

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
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
