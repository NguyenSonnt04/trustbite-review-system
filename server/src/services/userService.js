import appConfig from '../config/app.js';
import { pool } from '../config/db.js';
import { createHttpError } from '../utils/httpErrors.js';

const ACTIVE_DELETION_STATUSES = ['REQUESTED', 'PROCESSING'];
const ACCOUNT_DELETION_REASON_MAX_LENGTH = 500;
const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];

const normalizeRole = (role) => (role == null ? '' : String(role).trim().toUpperCase());
const normalizeRoleList = (roles = []) => [...new Set(roles.map(normalizeRole).filter(Boolean))];

const mapUserRow = (row) => ({
  id: row.id,
  phoneNumber: row.phone_number,
  displayName: row.display_name,
  avatarUrl: row.avatar_url,
  status: row.status,
  expPoints: row.exp_points,
  rankCode: row.rank_code,
  deletionRequestedAt: row.deletion_requested_at,
  deletedAt: row.deleted_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const mapDeletionRequestRow = (row) => ({
  deletionRequestId: row.id,
  userId: row.user_id,
  status: row.status,
  reason: row.reason,
  requestedAt: row.requested_at,
  scheduledDeletionAt: row.scheduled_deletion_at,
  completedAt: row.completed_at,
  cancelledAt: row.cancelled_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const requireUser = async (client, userId, { forUpdate = false } = {}) => {
  const result = await client.query(`SELECT * FROM users WHERE id = $1${forUpdate ? ' FOR UPDATE' : ''}`, [userId]);
  if (result.rowCount === 0) {
    throw createHttpError(404, 'USER_NOT_FOUND', 'User not found');
  }
  return result.rows[0];
};

const validateCurrentUserCanRead = (user) => {
  if (user.status === 'SUSPENDED') {
    throw createHttpError(403, 'ACCOUNT_SUSPENDED', 'Account is suspended');
  }
  if (user.status === 'DELETED') {
    throw createHttpError(403, 'ACCOUNT_DELETED', 'Account is deleted');
  }
};

const validateCurrentUserCanMutate = (user) => {
  validateCurrentUserCanRead(user);
};

const assertNoActiveDeletionRequest = async (client, userId) => {
  const result = await client.query(
    'SELECT id, status FROM account_deletion_requests WHERE user_id = $1 AND status = ANY($2::varchar[]) ORDER BY requested_at DESC LIMIT 1',
    [userId, ACTIVE_DELETION_STATUSES]
  );

  if (result.rowCount > 0) {
    throw createHttpError(409, 'DELETION_REQUEST_ACTIVE', 'Account deletion request is active');
  }
};

const normalizeDisplayName = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw createHttpError(422, 'VALIDATION_ERROR', 'displayName must be a string');
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > 120) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'displayName must be at most 120 characters');
  }
  return trimmed;
};

const normalizeAvatarUrl = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw createHttpError(422, 'VALIDATION_ERROR', 'avatarUrl must be a string URL');
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw createHttpError(422, 'VALIDATION_ERROR', 'avatarUrl must be a valid URL');
  }

  if (appConfig.avatarAllowedHosts.length === 0) {
    throw createHttpError(422, 'AVATAR_ORIGIN_NOT_ALLOWED', 'Avatar URL allowlist is not configured');
  }

  if (parsed.protocol !== 'https:') {
    throw createHttpError(422, 'AVATAR_ORIGIN_NOT_ALLOWED', 'Avatar URL must use HTTPS');
  }

  if (!appConfig.avatarAllowedHosts.includes(parsed.hostname.toLowerCase())) {
    throw createHttpError(422, 'AVATAR_ORIGIN_NOT_ALLOWED', 'Avatar URL origin is not allowed');
  }

  return parsed.href;
};

const validateAdminReason = (reason) => {
  if (typeof reason !== 'string' || reason.trim().length < 10) {
    throw createHttpError(422, 'ADMIN_REASON_REQUIRED', 'Admin reason must be at least 10 characters');
  }
  return reason.trim();
};

const getActorRoles = (actor) => normalizeRoleList(actor?.roles || []);

const assertAdminActor = (actor) => {
  const roles = getActorRoles(actor);
  if (!roles.some((role) => ADMIN_ROLES.includes(role))) {
    throw createHttpError(403, 'FORBIDDEN', 'Admin role required');
  }
};

const getAdminActorRole = (actor) => {
  const roles = getActorRoles(actor);
  if (roles.includes('SUPER_ADMIN')) {
    return 'SUPER_ADMIN';
  }

  if (roles.includes('ADMIN')) {
    return 'ADMIN';
  }

  return null;
};

const getUserRoles = async (client, userId) => {
  const result = await client.query('SELECT role_id FROM user_roles WHERE user_id = $1', [userId]);
  return normalizeRoleList(result.rows.map((row) => row.role_id));
};

const assertAdminCanTargetUser = async (client, actor, targetUserId) => {
  const actorRole = getAdminActorRole(actor);
  if (actorRole === 'SUPER_ADMIN') {
    return;
  }

  const targetRoles = await getUserRoles(client, targetUserId);
  if (targetRoles.includes('SUPER_ADMIN')) {
    throw createHttpError(403, 'INSUFFICIENT_ADMIN_TIER', 'ADMIN cannot modify SUPER_ADMIN accounts');
  }
};

const ACCOUNT_DELETION_CONFIRMATION_TEXT = 'XÓA TÀI KHOẢN'.normalize('NFC');

const normalizeConfirmationText = (value) => (
  typeof value === 'string' ? value.normalize('NFC') : value
);

export class UserService {
  async getCurrentUser(userId) {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (result.rowCount === 0) {
      throw createHttpError(404, 'USER_NOT_FOUND', 'User not found');
    }
    validateCurrentUserCanRead(result.rows[0]);
    return mapUserRow(result.rows[0]);
  }

  async updateCurrentUser(userId, body) {
    const displayName = normalizeDisplayName(body.displayName);
    const avatarUrl = normalizeAvatarUrl(body.avatarUrl);

    if (displayName === undefined && avatarUrl === undefined) {
      throw createHttpError(422, 'VALIDATION_ERROR', 'At least one profile field is required');
    }

    const updates = [];
    const values = [];

    if (displayName !== undefined) {
      values.push(displayName);
      updates.push(`display_name = $${values.length}`);
    }

    if (avatarUrl !== undefined) {
      values.push(avatarUrl);
      updates.push(`avatar_url = $${values.length}`);
    }

    values.push(userId);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const current = await requireUser(client, userId, { forUpdate: true });
      validateCurrentUserCanMutate(current);
      await assertNoActiveDeletionRequest(client, userId);

      const result = await client.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
        values
      );
      await client.query('COMMIT');
      return mapUserRow(result.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async createDeletionRequest(userId, body) {
    if (normalizeConfirmationText(body.confirmationText) !== ACCOUNT_DELETION_CONFIRMATION_TEXT) {
      throw createHttpError(422, 'VALIDATION_ERROR', 'confirmationText must match required deletion phrase');
    }

    const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : null;
    if (reason !== null && reason.length > ACCOUNT_DELETION_REASON_MAX_LENGTH) {
      throw createHttpError(422, 'VALIDATION_ERROR', 'reason must be at most 500 characters');
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const user = await requireUser(client, userId, { forUpdate: true });
      validateCurrentUserCanMutate(user);

      const existing = await client.query(
        'SELECT * FROM account_deletion_requests WHERE user_id = $1 AND status = ANY($2::varchar[]) ORDER BY requested_at DESC LIMIT 1',
        [userId, ACTIVE_DELETION_STATUSES]
      );

      if (existing.rowCount > 0) {
        throw createHttpError(409, 'DELETION_REQUEST_ALREADY_EXISTS', 'Account deletion request already exists');
      }

      const insert = await client.query(
        `INSERT INTO account_deletion_requests (user_id, reason, scheduled_deletion_at)
         VALUES ($1, $2, NULL)
         RETURNING *`,
        [userId, reason]
      );

      await client.query('UPDATE users SET deletion_requested_at = now() WHERE id = $1', [userId]);
      const revokedSessions = await client.query('UPDATE user_sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
      const inactivatedPushTokens = await client.query('UPDATE push_tokens SET status = $2 WHERE user_id = $1 AND status = $3', [userId, 'INACTIVE', 'ACTIVE']);

      await client.query(
        `INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, previous_status, new_status, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          userId,
          'USER',
          'ACCOUNT_DELETION_REQUESTED',
          'ACCOUNT_DELETION_REQUEST',
          insert.rows[0].id,
          null,
          'REQUESTED',
          {
            revokedSessions: revokedSessions.rowCount,
            inactivatedPushTokens: inactivatedPushTokens.rowCount,
          },
        ]
      );

      await client.query('COMMIT');
      return mapDeletionRequestRow(insert.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getOpenDeletionRequest(userId) {
    const result = await pool.query(
      'SELECT * FROM account_deletion_requests WHERE user_id = $1 AND status = ANY($2::varchar[]) ORDER BY requested_at DESC LIMIT 1',
      [userId, ACTIVE_DELETION_STATUSES]
    );

    if (result.rowCount === 0) {
      throw createHttpError(404, 'DELETION_REQUEST_NOT_FOUND', 'Deletion request not found');
    }

    return mapDeletionRequestRow(result.rows[0]);
  }

  async cancelDeletionRequest(userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const user = await requireUser(client, userId, { forUpdate: true });
      validateCurrentUserCanMutate(user);

      const current = await client.query(
        'SELECT * FROM account_deletion_requests WHERE user_id = $1 AND status = $2 ORDER BY requested_at DESC LIMIT 1 FOR UPDATE',
        [userId, 'REQUESTED']
      );

      if (current.rowCount === 0) {
        throw createHttpError(404, 'DELETION_REQUEST_NOT_FOUND', 'Cancellable deletion request not found');
      }

      const updated = await client.query(
        `UPDATE account_deletion_requests
         SET status = 'CANCELLED', cancelled_at = now()
         WHERE id = $1 AND status = 'REQUESTED'
         RETURNING *`,
        [current.rows[0].id]
      );

      if (updated.rowCount === 0) {
        throw createHttpError(409, 'DELETION_REQUEST_NOT_CANCELLABLE', 'Deletion request cannot be cancelled');
      }

      await client.query('UPDATE users SET deletion_requested_at = NULL WHERE id = $1', [userId]);
      await client.query(
        `INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, previous_status, new_status, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          userId,
          'USER',
          'ACCOUNT_DELETION_CANCELLED',
          'ACCOUNT_DELETION_REQUEST',
          updated.rows[0].id,
          current.rows[0].status,
          updated.rows[0].status,
          {},
        ]
      );
      await client.query('COMMIT');
      return mapDeletionRequestRow(updated.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async suspendUser(actor, targetUserId, reasonInput) {
    assertAdminActor(actor);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const target = await requireUser(client, targetUserId, { forUpdate: true });
      await assertAdminCanTargetUser(client, actor, target.id);

      if (target.status === 'DELETED') {
        throw createHttpError(400, 'CANNOT_SUSPEND_DELETED_USER', 'Deleted user cannot be suspended');
      }
      if (actor.id === target.id) {
        throw createHttpError(403, 'CANNOT_SUSPEND_SELF', 'Admins cannot suspend themselves');
      }
      if (target.status === 'SUSPENDED') {
        throw createHttpError(409, 'USER_ALREADY_SUSPENDED', 'User is already suspended');
      }

      const reason = validateAdminReason(reasonInput);

      const update = await client.query(
        `UPDATE users SET status = 'SUSPENDED'
         WHERE id = $1
         RETURNING *`,
        [targetUserId]
      );

      const revoked = await client.query(
        'UPDATE user_sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE user_id = $1 AND revoked_at IS NULL RETURNING id',
        [targetUserId]
      );
      await client.query('UPDATE push_tokens SET status = $2 WHERE user_id = $1 AND status = $3', [targetUserId, 'INACTIVE', 'ACTIVE']);

      const audit = await client.query(
        `INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, previous_status, new_status, reason, metadata)
         VALUES ($1, $2, 'USER_SUSPEND', 'USER', $3, $4, 'SUSPENDED', $5, $6)
         RETURNING id`,
        [actor.id, getAdminActorRole(actor), targetUserId, target.status, reason, { revokedSessions: revoked.rowCount }]
      );

      await client.query('COMMIT');
      return {
        userId: update.rows[0].id,
        status: update.rows[0].status,
        revokedSessions: revoked.rowCount,
        auditLogId: audit.rows[0].id
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async reactivateUser(actor, targetUserId, reasonInput) {
    assertAdminActor(actor);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const target = await requireUser(client, targetUserId, { forUpdate: true });
      await assertAdminCanTargetUser(client, actor, target.id);

      if (target.status === 'DELETED') {
        throw createHttpError(400, 'CANNOT_REACTIVATE_DELETED_USER', 'Deleted user cannot be reactivated');
      }
      if (actor.id === target.id) {
        throw createHttpError(403, 'CANNOT_REACTIVATE_SELF', 'Admins cannot reactivate themselves');
      }
      if (target.status !== 'SUSPENDED') {
        throw createHttpError(409, 'USER_NOT_SUSPENDED', 'User is not suspended');
      }

      const reason = validateAdminReason(reasonInput);

      const update = await client.query(
        `UPDATE users SET status = 'ACTIVE'
         WHERE id = $1
         RETURNING *`,
        [targetUserId]
      );

      const audit = await client.query(
        `INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, previous_status, new_status, reason)
         VALUES ($1, $2, 'USER_REACTIVATE', 'USER', $3, $4, 'ACTIVE', $5)
         RETURNING id`,
        [actor.id, getAdminActorRole(actor), targetUserId, target.status, reason]
      );

      await client.query('COMMIT');
      return {
        userId: update.rows[0].id,
        status: update.rows[0].status,
        auditLogId: audit.rows[0].id
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

export const userService = new UserService();
