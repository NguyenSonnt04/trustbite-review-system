import { pool } from '../config/db.js';
import { cognitoIdentityProvider } from './identityProviders/cognitoProvider.js';
import appConfig from '../config/app.js';
import { createHttpError } from '../utils/httpErrors.js';

const getBearerToken = (authorizationHeader) => {
  if (!authorizationHeader) {
    throw createHttpError(401, 'AUTH_REQUIRED', 'Bearer token is required');
  }

  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw createHttpError(401, 'INVALID_TOKEN', 'Authorization header must use Bearer scheme');
  }

  return match[1];
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeRole = (role) => (role == null ? '' : String(role).trim().toUpperCase());
const normalizeRoleList = (roles = []) => [...new Set(roles.map(normalizeRole).filter(Boolean))];

const parseTrustedRoles = (rolesHeader = '') => normalizeRoleList(rolesHeader.split(','));

const getTrustedDevelopmentIdentity = (req) => {
  if (appConfig.env === 'production' || !appConfig.trustedAuthHeaders) {
    return null;
  }

  const userId = req.header('x-trustbite-user-id');
  if (!userId) {
    return null;
  }

  if (!UUID_REGEX.test(userId)) {
    throw createHttpError(401, 'INVALID_TRUSTED_IDENTITY', 'Trusted local user id must be a UUID');
  }

  return {
    provider: 'trusted-local',
    subject: req.header('x-trustbite-subject') || req.header('x-trustbite-cognito-sub') || `local:${userId}`,
    phoneNumber: req.header('x-trustbite-phone-number') || null,
    phoneNumberVerified: true,
    localUserId: userId,
    roles: parseTrustedRoles(req.header('x-trustbite-roles')),
    tokenUse: 'access',
    claims: {
      trustedDevelopmentHeader: true
    }
  };
};

const createUnmappedIdentityError = () => (
  createHttpError(401, 'UNMAPPED_IDENTITY', 'External identity cannot be mapped to a local user')
);

const getIdentityProvider = () => {
  if (appConfig.auth.provider === 'cognito') {
    return cognitoIdentityProvider;
  }

  throw createHttpError(500, 'AUTH_PROVIDER_UNSUPPORTED', 'Configured auth provider is not supported');
};

const USER_WITH_ACTIVE_DELETION_REQUEST_SELECT = `
  SELECT
    u.*,
    adr.id AS active_deletion_request_id,
    adr.status AS active_deletion_request_status
  FROM users u
  LEFT JOIN LATERAL (
    SELECT id, status
    FROM account_deletion_requests
    WHERE user_id = u.id
      AND status IN ('REQUESTED', 'PROCESSING')
    ORDER BY requested_at DESC
    LIMIT 1
  ) adr ON true`;

const selectUserByLocalId = (localUserId, queryable = pool) => queryable.query(
  `${USER_WITH_ACTIVE_DELETION_REQUEST_SELECT}
   WHERE u.id = $1`,
  [localUserId],
);

const selectUserByCognitoSubject = (subject, queryable = pool) => queryable.query(
  `${USER_WITH_ACTIVE_DELETION_REQUEST_SELECT}
   WHERE u.cognito_sub = $1`,
  [subject],
);

const insertCognitoUser = (subject, queryable) => queryable.query(
  `INSERT INTO users (phone_number, cognito_sub)
   VALUES (NULL, $1)
   ON CONFLICT (cognito_sub) WHERE cognito_sub IS NOT NULL
   DO UPDATE SET cognito_sub = EXCLUDED.cognito_sub
   RETURNING *`,
  [subject],
);

const provisionCognitoUser = async (identity) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await insertCognitoUser(identity.subject, client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const findUserByIdentity = async (identity, { allowProvision = true } = {}) => {
  if (identity.localUserId) {
    if (!UUID_REGEX.test(identity.localUserId)) {
      throw createUnmappedIdentityError();
    }
    return selectUserByLocalId(identity.localUserId);
  }

  if (identity.subject) {
    const subjectResult = await selectUserByCognitoSubject(identity.subject);
    if (subjectResult.rowCount > 0) {
      return subjectResult;
    }
  }

  if (
    identity.subject
    && identity.phoneNumber
    && identity.phoneNumberVerified
    && appConfig.auth.phoneFallbackEnabled
  ) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const phoneResult = await client.query(
        `${USER_WITH_ACTIVE_DELETION_REQUEST_SELECT}
         WHERE u.phone_number = $1
           AND u.cognito_sub IS NULL
         FOR UPDATE OF u`,
        [identity.phoneNumber]
      );

      if (phoneResult.rowCount === 0) {
        const remappedResult = await selectUserByCognitoSubject(identity.subject, client);
        if (remappedResult.rowCount > 0) {
          await client.query('COMMIT');
          return remappedResult;
        }

        if (identity.provider === 'cognito' && allowProvision) {
          const provisionedResult = await insertCognitoUser(identity.subject, client);
          await client.query('COMMIT');
          return provisionedResult;
        }

        await client.query('COMMIT');
        return remappedResult;
      }

      const mappedResult = await client.query(
        `WITH updated_user AS (
           UPDATE users
           SET cognito_sub = $1
           WHERE id = $2 AND cognito_sub IS NULL
           RETURNING *
         )
         SELECT
           u.*,
           adr.id AS active_deletion_request_id,
           adr.status AS active_deletion_request_status
         FROM updated_user u
         LEFT JOIN LATERAL (
           SELECT id, status
           FROM account_deletion_requests
           WHERE user_id = u.id
             AND status IN ('REQUESTED', 'PROCESSING')
           ORDER BY requested_at DESC
           LIMIT 1
         ) adr ON true`,
        [identity.subject, phoneResult.rows[0].id]
      );

      await client.query('COMMIT');
      return mappedResult;
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code === '23505') {
        throw createUnmappedIdentityError();
      }
      throw err;
    } finally {
      client.release();
    }
  }

  if (identity.provider === 'cognito' && identity.subject && allowProvision) {
    return provisionCognitoUser(identity);
  }

  throw createUnmappedIdentityError();
};

const assertAccountCanAuthenticate = (user) => {
  if (user.status === 'SUSPENDED') {
    throw createHttpError(403, 'ACCOUNT_SUSPENDED', 'Account is suspended');
  }

  if (user.status === 'DELETED') {
    throw createHttpError(403, 'ACCOUNT_DELETED', 'Account is deleted');
  }
};

const mapPublicIdentity = (identity) => ({
  provider: identity.provider,
  subject: identity.subject,
  tokenUse: identity.tokenUse,
  phoneNumber: identity.phoneNumber || null,
  phoneNumberVerified: identity.phoneNumberVerified === true
});

const mapCognitoContext = (identity) => {
  if (identity.provider !== 'cognito') {
    return undefined;
  }

  return {
    sub: identity.subject,
    tokenUse: identity.tokenUse,
    phoneNumber: identity.phoneNumber || null,
    phoneNumberVerified: identity.phoneNumberVerified === true
  };
};

const mapDatabaseRoles = (databaseRoleRows) => normalizeRoleList(databaseRoleRows.map((row) => row.role_id));

const mapProviderRoles = (identity) => {
  if (identity.provider !== 'trusted-local') {
    return [];
  }

  return Array.isArray(identity.roles) ? normalizeRoleList(identity.roles) : [];
};

const mapActiveDeletionRequest = (user) => (
  user.active_deletion_request_id
    ? {
      id: user.active_deletion_request_id,
      status: user.active_deletion_request_status,
    }
    : null
);

export class AuthService {
  constructor(identityProvider = getIdentityProvider()) {
    this.identityProvider = identityProvider;
  }

  async authenticateRequest(req, options = {}) {
    const trustedIdentity = getTrustedDevelopmentIdentity(req);
    if (trustedIdentity) {
      return this.mapIdentityToUser(trustedIdentity, options);
    }

    const token = getBearerToken(req.header('authorization'));
    const identity = await this.identityProvider.verifyAccessToken(token);
    return this.mapIdentityToUser(identity, options);
  }

  async mapIdentityToUser(identity, { enforceStatus = true, allowProvision = true } = {}) {
    const userResult = await findUserByIdentity(identity, { allowProvision });
    if (userResult.rowCount === 0) {
      throw createUnmappedIdentityError();
    }

    const user = userResult.rows[0];
    if (enforceStatus) {
      assertAccountCanAuthenticate(user);
    }

    const roleResult = await pool.query(
      `SELECT role_id FROM user_roles WHERE user_id = $1`,
      [user.id]
    );

    const databaseRoles = mapDatabaseRoles(roleResult.rows);
    const providerRoles = mapProviderRoles(identity);

    return {
      id: user.id,
      phoneNumber: user.phone_number,
      displayName: user.display_name,
      cognitoSub: user.cognito_sub || null,
      status: user.status,
      activeDeletionRequest: mapActiveDeletionRequest(user),
      roles: normalizeRoleList([...databaseRoles, ...providerRoles]),
      databaseRoles,
      providerRoles,
      identity: mapPublicIdentity(identity),
      cognito: mapCognitoContext(identity)
    };
  }
}

export const authService = new AuthService();
