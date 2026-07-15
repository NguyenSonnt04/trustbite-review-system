import { pool } from '../config/db.js';
import { cognitoIdentityProvider } from './identityProviders/cognitoProvider.js';
import { createHttpError, HttpError } from '../utils/httpErrors.js';

const ADMIN_ROLES = new Set(['ADMIN', 'SUPER_ADMIN']);
const MANAGEABLE_ROLES = new Set(['USER', 'ADMIN', 'SUPER_ADMIN']);
const USER_STATUSES = new Set(['ACTIVE', 'SUSPENDED', 'DELETED']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const USER_CREATE_FIELDS = new Set(['email', 'displayName', 'phoneNumber', 'dateOfBirth']);
const USER_UPDATE_FIELDS = new Set(['displayName', 'phoneNumber', 'dateOfBirth', 'roles', 'reason']);

const assertAllowedFields = (body, allowedFields) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'Request body must be an object');
  }
  const unknownField = Object.keys(body).find((field) => !allowedFields.has(field));
  if (unknownField) {
    throw createHttpError(422, 'VALIDATION_ERROR', `Unsupported field: ${unknownField}`);
  }
};

const normalizeRoleList = (roles = []) => [...new Set(
  roles.map((role) => String(role).trim().toUpperCase()).filter(Boolean),
)].sort();

const getActorRole = (actor) => {
  const roles = normalizeRoleList(actor?.roles);
  if (roles.includes('SUPER_ADMIN')) return 'SUPER_ADMIN';
  if (roles.includes('ADMIN')) return 'ADMIN';
  return null;
};

const assertAdminActor = (actor) => {
  if (!getActorRole(actor)) {
    throw createHttpError(403, 'FORBIDDEN', 'Admin role required');
  }
};

const normalizeEmail = (value) => {
  if (typeof value !== 'string') {
    throw createHttpError(422, 'VALIDATION_ERROR', 'email must be a string');
  }
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'email must be a valid email address');
  }
  return email;
};

const normalizeDisplayName = (value, { required = false } = {}) => {
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string') {
    throw createHttpError(422, 'VALIDATION_ERROR', 'displayName must be a string');
  }
  const displayName = value.trim();
  if (!displayName || displayName.length > 120) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'displayName must contain 1 to 120 characters');
  }
  return displayName;
};

const normalizePhoneNumber = (value, { required = false } = {}) => {
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string') {
    throw createHttpError(422, 'VALIDATION_ERROR', 'phoneNumber must be a string');
  }
  let phoneNumber = value.trim().replace(/[\s().-]/gu, '');
  if (/^0\d{9}$/u.test(phoneNumber)) {
    phoneNumber = `+84${phoneNumber.slice(1)}`;
  } else if (/^84\d{9}$/u.test(phoneNumber)) {
    phoneNumber = `+${phoneNumber}`;
  }
  if (!/^\+[1-9]\d{7,14}$/u.test(phoneNumber)) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'phoneNumber must be a valid international number');
  }
  return phoneNumber;
};

const normalizeDateOfBirth = (value, { required = false } = {}) => {
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'dateOfBirth must use YYYY-MM-DD');
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  const today = new Date().toISOString().slice(0, 10);
  if (
    Number.isNaN(parsed.getTime())
    || parsed.toISOString().slice(0, 10) !== value
    || value < '1900-01-01'
    || value > today
  ) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'dateOfBirth must be a real date between 1900-01-01 and today');
  }
  return value;
};

const normalizeReason = (value) => {
  if (typeof value !== 'string' || value.trim().length < 10 || value.trim().length > 500) {
    throw createHttpError(422, 'ADMIN_REASON_REQUIRED', 'Admin reason must contain 10 to 500 characters');
  }
  return value.trim();
};

const normalizeRequestedRoles = (value) => {
  if (!Array.isArray(value) || value.length === 0) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'roles must be a non-empty array');
  }
  const roles = normalizeRoleList(value);
  if (!roles.includes('USER') || roles.some((role) => !MANAGEABLE_ROLES.has(role))) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'roles must include USER and contain only manageable roles');
  }
  return roles;
};

const mapDateOnly = (value) => {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};

const maskPhoneNumber = (value) => {
  if (!value) return null;
  const phone = String(value);
  if (phone.length <= 6) return `${phone.slice(0, 2)}***`;
  return `${phone.slice(0, 3)}${'*'.repeat(Math.max(3, phone.length - 6))}${phone.slice(-3)}`;
};

const mapUserRow = (row, { masked = false } = {}) => ({
  id: row.id,
  displayName: row.display_name?.trim() || null,
  phoneNumberMasked: maskPhoneNumber(row.phone_number),
  ...(masked
    ? {}
    : { phoneNumber: row.phone_number?.trim() || null }),
  dateOfBirth: mapDateOnly(row.date_of_birth),
  avatarUrl: row.avatar_url,
  status: row.status,
  roles: normalizeRoleList(row.roles || []),
  rankCode: row.rank_code,
  expPoints: row.exp_points,
  reviewRestrictedUntil: row.review_restricted_until,
  deletionRequestedAt: row.deletion_requested_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const parseListQuery = (query = {}) => {
  const page = Number(query.page ?? 1);
  const pageSize = Number(query.pageSize ?? 20);
  if (!Number.isInteger(page) || page < 1) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'page must be a positive integer');
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'pageSize must be between 1 and 100');
  }

  const keyword = query.keyword == null ? '' : String(query.keyword).trim();
  if (keyword.length > 120) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'keyword must be at most 120 characters');
  }

  const status = query.status == null || query.status === ''
    ? null
    : String(query.status).trim().toUpperCase();
  if (status && !USER_STATUSES.has(status)) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'status is invalid');
  }

  const role = query.role == null || query.role === ''
    ? null
    : String(query.role).trim().toUpperCase();
  if (role && !MANAGEABLE_ROLES.has(role)) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'role is invalid');
  }

  const maskedPhoneSuffix = keyword.includes('*')
    ? keyword.match(/(\d{3,})$/u)?.[1] || null
    : null;

  return { page, pageSize, keyword, status, role, maskedPhoneSuffix };
};

const getUserForUpdate = async (client, userId) => {
  const result = await client.query(
    `SELECT u.*, ARRAY(
       SELECT ur.role_id FROM user_roles ur
       WHERE ur.user_id = u.id ORDER BY ur.role_id
     ) AS roles
     FROM users u
     WHERE u.id = $1
     FOR UPDATE OF u`,
    [userId],
  );
  if (result.rowCount === 0) {
    throw createHttpError(404, 'USER_NOT_FOUND', 'User not found');
  }
  return result.rows[0];
};

const assertActorCanTarget = (actor, target) => {
  if (getActorRole(actor) === 'ADMIN' && normalizeRoleList(target.roles).includes('SUPER_ADMIN')) {
    throw createHttpError(403, 'INSUFFICIENT_ADMIN_TIER', 'ADMIN cannot modify SUPER_ADMIN accounts');
  }
};

const mapPersistenceError = (err) => {
  if (err instanceof HttpError) return err;
  if (err.code === '23505' && err.constraint === 'users_phone_number_key') {
    return createHttpError(409, 'PHONE_NUMBER_IN_USE', 'Phone number is already in use');
  }
  if (err.code === '23505' && err.constraint === 'users_cognito_sub_unique') {
    return createHttpError(409, 'IDENTITY_ALREADY_MAPPED', 'Identity is already mapped');
  }
  return err;
};

export class AdminUserManagementService {
  constructor({ identityProvider = cognitoIdentityProvider } = {}) {
    this.identityProvider = identityProvider;
  }

  async listUsers(actor, query) {
    assertAdminActor(actor);
    const {
      page,
      pageSize,
      keyword,
      status,
      role,
      maskedPhoneSuffix,
    } = parseListQuery(query);
    const result = await pool.query(
      `WITH filtered AS (
         SELECT u.*, ARRAY(
           SELECT user_role.role_id FROM user_roles user_role
           WHERE user_role.user_id = u.id ORDER BY user_role.role_id
         ) AS roles
         FROM users u
         WHERE ($1::text = ''
             OR u.display_name ILIKE '%' || $1 || '%'
             OR u.phone_number ILIKE '%' || $1 || '%'
             OR u.id::text ILIKE '%' || $1 || '%'
             OR ($6::text IS NOT NULL AND u.phone_number LIKE '%' || $6))
           AND ($2::text IS NULL OR u.status = $2)
           AND ($3::text IS NULL OR EXISTS (
             SELECT 1 FROM user_roles filtered_role
             WHERE filtered_role.user_id = u.id
               AND filtered_role.role_id = $3
           ))
       )
       SELECT page_rows.*, total.total_count
       FROM (SELECT count(*)::integer AS total_count FROM filtered) total
       LEFT JOIN LATERAL (
         SELECT * FROM filtered
         ORDER BY created_at DESC, id DESC
         LIMIT $4 OFFSET $5
       ) page_rows ON true`,
      [keyword, status, role, pageSize, (page - 1) * pageSize, maskedPhoneSuffix],
    );

    return {
      items: result.rows.filter((row) => row.id).map((row) => mapUserRow(row, { masked: true })),
      page,
      pageSize,
      total: result.rows[0]?.total_count ?? 0,
    };
  }

  async getUser(actor, userId) {
    assertAdminActor(actor);
    const result = await pool.query(
      `SELECT u.*, ARRAY(
         SELECT ur.role_id FROM user_roles ur
         WHERE ur.user_id = u.id ORDER BY ur.role_id
       ) AS roles
       FROM users u
       WHERE u.id = $1`,
      [userId],
    );
    if (result.rowCount === 0) {
      throw createHttpError(404, 'USER_NOT_FOUND', 'User not found');
    }
    return mapUserRow(result.rows[0]);
  }

  async createUser(actor, body = {}) {
    assertAdminActor(actor);
    assertAllowedFields(body, USER_CREATE_FIELDS);
    const email = normalizeEmail(body.email);
    const displayName = normalizeDisplayName(body.displayName, { required: true });
    const phoneNumber = normalizePhoneNumber(body.phoneNumber, { required: true });
    const dateOfBirth = normalizeDateOfBirth(body.dateOfBirth, { required: true });
    const providerUser = await this.identityProvider.createUser({ email });
    let client;
    let commitAttempted = false;

    try {
      client = await pool.connect();
      await client.query('BEGIN');
      const inserted = await client.query(
        `INSERT INTO users (cognito_sub, display_name, phone_number, date_of_birth)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [providerUser.subject, displayName, phoneNumber, dateOfBirth],
      );
      await client.query(
        'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
        [inserted.rows[0].id, 'USER'],
      );
      await client.query(
        `INSERT INTO audit_logs
           (actor_id, actor_role, action, entity_type, entity_id, new_status, metadata)
         VALUES ($1, $2, 'USER_CREATE', 'USER', $3, 'ACTIVE', $4)`,
        [actor.id, getActorRole(actor), inserted.rows[0].id, { roles: ['USER'] }],
      );
      commitAttempted = true;
      await client.query('COMMIT');
      return mapUserRow({ ...inserted.rows[0], roles: ['USER'] });
    } catch (err) {
      if (client) {
        await client.query('ROLLBACK').catch(() => undefined);
      }
      if (commitAttempted) {
        let committedUser;
        try {
          committedUser = await pool.query(
            `SELECT u.*, ARRAY(
               SELECT ur.role_id FROM user_roles ur
               WHERE ur.user_id = u.id ORDER BY ur.role_id
             ) AS roles
             FROM users u
             WHERE u.cognito_sub = $1`,
            [providerUser.subject],
          );
        } catch {
          throw createHttpError(
            503,
            'USER_PROVISIONING_OUTCOME_UNKNOWN',
            'User provisioning outcome could not be verified safely',
          );
        }
        if (committedUser.rowCount > 0) {
          return mapUserRow(committedUser.rows[0]);
        }
      }
      try {
        await this.identityProvider.deleteUser({ username: providerUser.username });
      } catch {
        throw createHttpError(
          503,
          'USER_PROVISIONING_COMPENSATION_FAILED',
          'User provisioning could not be completed safely',
        );
      }
      throw mapPersistenceError(err);
    } finally {
      client?.release();
    }
  }

  async updateUser(actor, userId, body = {}) {
    assertAdminActor(actor);
    assertAllowedFields(body, USER_UPDATE_FIELDS);
    const displayName = normalizeDisplayName(body.displayName);
    const phoneNumber = normalizePhoneNumber(body.phoneNumber);
    const dateOfBirth = normalizeDateOfBirth(body.dateOfBirth);
    const requestedRoles = body.roles === undefined ? undefined : normalizeRequestedRoles(body.roles);
    const profileFields = [
      displayName !== undefined ? 'displayName' : null,
      phoneNumber !== undefined ? 'phoneNumber' : null,
      dateOfBirth !== undefined ? 'dateOfBirth' : null,
    ].filter(Boolean);
    if (profileFields.length === 0 && requestedRoles === undefined) {
      throw createHttpError(422, 'VALIDATION_ERROR', 'At least one supported field is required');
    }
    if (requestedRoles !== undefined && getActorRole(actor) !== 'SUPER_ADMIN') {
      throw createHttpError(403, 'SUPER_ADMIN_REQUIRED', 'SUPER_ADMIN role is required to manage roles');
    }
    if (requestedRoles !== undefined && actor.id === userId) {
      throw createHttpError(403, 'CANNOT_CHANGE_OWN_ROLES', 'Administrators cannot change their own roles');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (requestedRoles !== undefined) {
        await client.query(
          "SELECT pg_advisory_xact_lock(hashtext('trustbite:super-admin-role-management'))",
        );
        const currentActor = await client.query(
          `SELECT u.status, u.deletion_requested_at,
             EXISTS (
               SELECT 1 FROM user_roles ur
               WHERE ur.user_id = u.id AND ur.role_id = 'SUPER_ADMIN'
             ) AS is_super_admin
           FROM users u
           WHERE u.id = $1
           FOR SHARE OF u`,
          [actor.id],
        );
        if (
          currentActor.rowCount === 0
          || currentActor.rows[0].status !== 'ACTIVE'
          || currentActor.rows[0].deletion_requested_at
          || !currentActor.rows[0].is_super_admin
        ) {
          throw createHttpError(
            403,
            'SUPER_ADMIN_REQUIRED',
            'Current SUPER_ADMIN authorization is required to manage roles',
          );
        }
      }
      const target = await getUserForUpdate(client, userId);
      assertActorCanTarget(actor, target);
      if (target.status === 'DELETED') {
        throw createHttpError(409, 'ACCOUNT_DELETED', 'Deleted users cannot be updated');
      }
      if (target.deletion_requested_at) {
        throw createHttpError(409, 'DELETION_REQUEST_ACTIVE', 'Account deletion request is active');
      }

      let updated = target;
      if (profileFields.length > 0) {
        const assignments = [];
        const values = [];
        if (displayName !== undefined) {
          values.push(displayName);
          assignments.push(`display_name = $${values.length}`);
        }
        if (phoneNumber !== undefined) {
          values.push(phoneNumber);
          assignments.push(`phone_number = $${values.length}`);
        }
        if (dateOfBirth !== undefined) {
          values.push(dateOfBirth);
          assignments.push(`date_of_birth = $${values.length}`);
        }
        values.push(userId);
        const result = await client.query(
          `UPDATE users
           SET ${assignments.join(', ')}, updated_at = now()
           WHERE id = $${values.length}
           RETURNING *`,
          values,
        );
        updated = { ...result.rows[0], roles: target.roles };
        await client.query(
          `INSERT INTO audit_logs
             (actor_id, actor_role, action, entity_type, entity_id, metadata)
           VALUES ($1, $2, 'USER_PROFILE_UPDATE', 'USER', $3, $4)`,
          [actor.id, getActorRole(actor), userId, { fields: profileFields }],
        );
      }

      let roles = normalizeRoleList(target.roles);
      if (requestedRoles !== undefined && JSON.stringify(requestedRoles) !== JSON.stringify(roles)) {
        if (roles.includes('SUPER_ADMIN') && !requestedRoles.includes('SUPER_ADMIN')) {
          const remaining = await client.query(
            `SELECT count(*)::integer AS count
             FROM user_roles ur
             JOIN users u ON u.id = ur.user_id
             WHERE ur.role_id = 'SUPER_ADMIN'
               AND ur.user_id <> $1
               AND u.status = 'ACTIVE'
               AND u.deletion_requested_at IS NULL`,
            [userId],
          );
          if (remaining.rows[0].count === 0) {
            throw createHttpError(
              409,
              'LAST_SUPER_ADMIN_REQUIRED',
              'At least one active SUPER_ADMIN must remain',
            );
          }
        }

        await client.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
        for (const role of requestedRoles) {
          await client.query(
            'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
            [userId, role],
          );
        }
        await client.query(
          `INSERT INTO audit_logs
             (actor_id, actor_role, action, entity_type, entity_id, reason, metadata)
           VALUES ($1, $2, 'USER_ROLES_UPDATE', 'USER', $3, $4, $5)`,
          [
            actor.id,
            getActorRole(actor),
            userId,
            normalizeReason(body.reason),
            { previousRoles: roles, newRoles: requestedRoles },
          ],
        );
        roles = requestedRoles;
      }

      await client.query('COMMIT');
      return mapUserRow({ ...updated, roles });
    } catch (err) {
      await client.query('ROLLBACK');
      throw mapPersistenceError(err);
    } finally {
      client.release();
    }
  }
}

export const adminUserManagementService = new AdminUserManagementService();
