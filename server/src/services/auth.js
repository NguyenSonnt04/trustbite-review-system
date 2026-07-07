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

const findUserByIdentity = async (identity) => {
  if (identity.localUserId) {
    if (!UUID_REGEX.test(identity.localUserId)) {
      throw createUnmappedIdentityError();
    }
    return pool.query('SELECT * FROM users WHERE id = $1', [identity.localUserId]);
  }

  if (identity.subject) {
    const subjectResult = await pool.query('SELECT * FROM users WHERE cognito_sub = $1', [identity.subject]);
    if (subjectResult.rowCount > 0 || !identity.phoneNumber) {
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
        'SELECT * FROM users WHERE phone_number = $1 AND cognito_sub IS NULL FOR UPDATE',
        [identity.phoneNumber]
      );

      if (phoneResult.rowCount === 0) {
        const remappedResult = await client.query(
          'SELECT * FROM users WHERE cognito_sub = $1',
          [identity.subject]
        );
        await client.query('COMMIT');
        return remappedResult;
      }

      const mappedResult = await client.query(
        `UPDATE users
         SET cognito_sub = $1
         WHERE id = $2 AND cognito_sub IS NULL
         RETURNING *`,
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

  async mapIdentityToUser(identity, { enforceStatus = true } = {}) {
    const userResult = await findUserByIdentity(identity);
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
      roles: normalizeRoleList([...databaseRoles, ...providerRoles]),
      databaseRoles,
      providerRoles,
      identity: mapPublicIdentity(identity),
      cognito: mapCognitoContext(identity)
    };
  }
}

export const authService = new AuthService();
