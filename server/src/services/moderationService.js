import { pool } from '../config/db.js';
import { createHttpError } from '../utils/httpErrors.js';

/**
 * moderationService — creation of user-submitted moderation reports.
 *
 * Contract source: API_Specification.md §7, Functional_Specification.md SAFETY-001,
 * Business_Rules.md BR-SAFE-002, Content_Moderation_Policy.md.
 *
 * Input parsing/validation happens at the HTTP boundary (controllers/moderation.js);
 * this service receives well-formed values and owns business rules + persistence.
 * A submitted report has status SUBMITTED; admin triage (moderation_actions,
 * status transitions) is out of scope here (task 6.4).
 */

// Fixed allow-list: keyed by the boundary-validated entityType, so no user input
// ever reaches the SQL identifier.
const ENTITY_TABLES = {
  REVIEW: 'reviews',
  USER: 'users',
  RESTAURANT: 'restaurants',
};

function mapDbError(err) {
  if (err && typeof err.statusCode === 'number') {
    return err;
  }
  if (err && err.code === '23505') {
    return createHttpError(409, 'REPORT_DUPLICATE', 'An open report already exists for this entity');
  }
  if (err && err.code === '23503') {
    return createHttpError(422, 'VALIDATION_ERROR', 'reasonCode is not a known report reason');
  }
  if (err && err.code === '22P02') {
    return createHttpError(422, 'VALIDATION_ERROR', 'Invalid identifier format');
  }
  return err;
}

async function safeRollback(client) {
  try {
    await client.query('ROLLBACK');
  } catch {
    // Intentionally ignored: preserve the original error for the caller.
  }
}

export async function createReport(reporterId, { entityType, entityId, reasonCode, description = null }) {
  if (entityType === 'USER' && entityId === reporterId) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'You cannot report your own account');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const reason = await client.query(
      'SELECT entity_type FROM report_reason_codes WHERE code = $1',
      [reasonCode]
    );
    if (reason.rowCount === 0) {
      throw createHttpError(422, 'VALIDATION_ERROR', 'reasonCode is not a known report reason');
    }
    if (reason.rows[0].entity_type !== entityType) {
      throw createHttpError(422, 'VALIDATION_ERROR', 'reasonCode does not match entityType');
    }

    const table = ENTITY_TABLES[entityType];
    const entity = await client.query(`SELECT id FROM ${table} WHERE id = $1`, [entityId]);
    if (entity.rowCount === 0) {
      throw createHttpError(422, 'VALIDATION_ERROR', 'Reported entity does not exist');
    }

    const existing = await client.query(
      `SELECT id FROM moderation_reports
       WHERE reporter_id = $1 AND entity_type = $2 AND entity_id = $3
         AND status NOT IN ('CLOSED', 'ACTION_TAKEN')`,
      [reporterId, entityType, entityId]
    );
    if (existing.rowCount > 0) {
      throw createHttpError(409, 'REPORT_DUPLICATE', 'An open report already exists for this entity');
    }

    const insert = await client.query(
      `INSERT INTO moderation_reports (reporter_id, entity_type, entity_id, reason_code, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, status`,
      [reporterId, entityType, entityId, reasonCode, description]
    );

    await client.query('COMMIT');
    return { reportId: insert.rows[0].id, status: insert.rows[0].status };
  } catch (err) {
    await safeRollback(client);
    throw mapDbError(err);
  } finally {
    client.release();
  }
}
