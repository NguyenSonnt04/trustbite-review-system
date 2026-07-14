import crypto from 'node:crypto';
import {
  AdminDeleteUserCommand,
  AdminUserGlobalSignOutCommand,
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RevokeTokenCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import appConfig from '../../config/app.js';
import awsConfig from '../../config/aws.js';
import { createHttpError } from '../../utils/httpErrors.js';

let cachedJwks = null;
let cachedAt = 0;
let pendingJwksFetch = null;
let lastUnknownKidRefreshAt = null;
const JWKS_TTL_MS = 60 * 60 * 1000;
const UNKNOWN_KID_REFRESH_COOLDOWN_MS = 30 * 1000;

const isJwkObject = (key) => Boolean(key) && typeof key === 'object' && !Array.isArray(key);
const isUserNotFoundError = (err) => err?.name === 'UserNotFoundException';

const base64UrlDecode = (value) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64');
};

const parseJsonPart = (value, partName) => {
  let parsed;
  try {
    parsed = JSON.parse(base64UrlDecode(value).toString('utf8'));
  } catch {
    throw createHttpError(401, 'INVALID_TOKEN', `Malformed JWT ${partName}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw createHttpError(401, 'INVALID_TOKEN', `Malformed JWT ${partName}`);
  }

  return parsed;
};

const loadJwksFromProvider = async () => {
  let response;
  try {
    response = await fetch(appConfig.auth.cognito.jwksUri);
  } catch {
    throw createHttpError(503, 'PROVIDER_UNAVAILABLE', 'Unable to load Cognito JWKS');
  }

  if (!response.ok) {
    throw createHttpError(503, 'PROVIDER_UNAVAILABLE', 'Unable to load Cognito JWKS');
  }

  let jwks;
  try {
    jwks = await response.json();
  } catch {
    throw createHttpError(503, 'PROVIDER_UNAVAILABLE', 'Invalid Cognito JWKS response');
  }

  if (
    !isJwkObject(jwks)
    || !Array.isArray(jwks.keys)
    || jwks.keys.some((key) => !isJwkObject(key))
  ) {
    throw createHttpError(503, 'PROVIDER_UNAVAILABLE', 'Invalid Cognito JWKS response');
  }

  cachedJwks = jwks;
  cachedAt = Date.now();
  return jwks;
};

const fetchJwks = async ({ forceRefresh = false } = {}) => {
  const now = Date.now();
  if (!forceRefresh && cachedJwks && now - cachedAt < JWKS_TTL_MS) {
    return cachedJwks;
  }

  if (!pendingJwksFetch) {
    pendingJwksFetch = loadJwksFromProvider().finally(() => {
      pendingJwksFetch = null;
    });
  }

  return pendingJwksFetch;
};

const refreshJwksForUnknownKid = async () => {
  if (pendingJwksFetch) {
    return pendingJwksFetch;
  }

  const now = Date.now();
  if (
    cachedJwks
    && lastUnknownKidRefreshAt !== null
    && now - lastUnknownKidRefreshAt < UNKNOWN_KID_REFRESH_COOLDOWN_MS
  ) {
    return cachedJwks;
  }

  const refreshedJwks = await fetchJwks({ forceRefresh: true });
  lastUnknownKidRefreshAt = Date.now();
  return refreshedJwks;
};

const verifySignature = async (token, header) => {
  if (header.alg !== 'RS256') {
    throw createHttpError(401, 'INVALID_TOKEN', 'Unsupported JWT algorithm');
  }

  const jwks = await fetchJwks();
  let jwk = jwks.keys.find((key) => key.kid === header.kid);
  if (!jwk) {
    const refreshedJwks = await refreshJwksForUnknownKid();
    jwk = refreshedJwks.keys.find((key) => key.kid === header.kid);
  }

  if (!jwk) {
    throw createHttpError(401, 'INVALID_TOKEN', 'Unknown JWT key id');
  }
  if (jwk.kty !== 'RSA' || jwk.alg !== 'RS256' || jwk.use !== 'sig') {
    throw createHttpError(503, 'PROVIDER_UNAVAILABLE', 'Invalid Cognito JWKS response');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${encodedHeader}.${encodedPayload}`);
  verifier.end();

  let publicKey;
  try {
    publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  } catch {
    throw createHttpError(503, 'PROVIDER_UNAVAILABLE', 'Invalid Cognito JWKS response');
  }

  let valid;
  try {
    valid = verifier.verify(publicKey, base64UrlDecode(encodedSignature));
  } catch {
    throw createHttpError(401, 'INVALID_TOKEN', 'Invalid JWT signature');
  }

  if (!valid) {
    throw createHttpError(401, 'INVALID_TOKEN', 'Invalid JWT signature');
  }
};

const validateAccessTokenClaims = (payload, expectedClientId = appConfig.auth.cognito.clientId) => {
  const now = Math.floor(Date.now() / 1000);
  const config = appConfig.auth.cognito;

  if (!payload.sub || typeof payload.sub !== 'string') {
    throw createHttpError(401, 'INVALID_TOKEN', 'JWT subject is required');
  }
  if (payload.iss !== config.issuer) {
    throw createHttpError(401, 'INVALID_TOKEN', 'JWT issuer is invalid');
  }
  if (payload.token_use !== 'access') {
    throw createHttpError(401, 'INVALID_TOKEN', 'JWT token_use is invalid');
  }
  if (payload.client_id !== expectedClientId) {
    throw createHttpError(401, 'INVALID_TOKEN', 'JWT client_id is invalid');
  }
  if (typeof payload.exp !== 'number' || payload.exp <= now) {
    throw createHttpError(401, 'TOKEN_EXPIRED', 'JWT is expired');
  }
  if (payload.nbf !== undefined) {
    if (typeof payload.nbf !== 'number' || !Number.isFinite(payload.nbf)) {
      throw createHttpError(401, 'INVALID_TOKEN', 'JWT nbf is invalid');
    }
    if (payload.nbf > now) {
      throw createHttpError(401, 'INVALID_TOKEN', 'JWT is not active yet');
    }
  }
};

export class CognitoIdentityProvider {
  provider = 'cognito';

  constructor({
    adminClient = null,
    authClient = null,
    userPoolId = appConfig.auth.cognito.userPoolId,
  } = {}) {
    this.adminClient = adminClient;
    this.authClient = authClient;
    this.userPoolId = userPoolId;
  }

  getAdminClient() {
    if (!this.adminClient) {
      this.adminClient = new CognitoIdentityProviderClient({
        region: awsConfig.region,
        endpoint: awsConfig.endpointUrl,
        credentials: awsConfig.credentials,
      });
    }

    return this.adminClient;
  }

  getAuthClient() {
    if (!this.authClient) {
      this.authClient = new CognitoIdentityProviderClient({
        region: awsConfig.region,
        endpoint: awsConfig.endpointUrl,
        credentials: awsConfig.credentials,
      });
    }

    return this.authClient;
  }

  async verifyAccessToken(token, { clientId } = {}) {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw createHttpError(401, 'INVALID_TOKEN', 'Malformed JWT');
    }

    const header = parseJsonPart(parts[0], 'header');
    const payload = parseJsonPart(parts[1], 'payload');

    await verifySignature(token, header);
    validateAccessTokenClaims(payload, clientId);

    return {
      provider: this.provider,
      subject: payload.sub,
      phoneNumber: payload.phone_number || null,
      phoneNumberVerified: payload.phone_number_verified === true,
      tokenUse: payload.token_use,
      roles: [],
      providerGroups: Array.isArray(payload['cognito:groups']) ? payload['cognito:groups'] : [],
      claims: payload
    };
  }

  async authenticatePassword({
    username,
    password,
    clientId,
    clientSecret = '',
  }) {
    if (!clientId) {
      throw createHttpError(503, 'AUTH_NOT_CONFIGURED', 'Admin authentication is not configured');
    }

    const authParameters = {
      USERNAME: username,
      PASSWORD: password,
    };
    if (clientSecret) {
      authParameters.SECRET_HASH = crypto
        .createHmac('sha256', clientSecret)
        .update(`${username}${clientId}`)
        .digest('base64');
    }

    let response;
    try {
      response = await this.getAuthClient().send(new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: clientId,
        AuthParameters: authParameters,
      }));
    } catch (err) {
      if (['NotAuthorizedException', 'UserNotFoundException'].includes(err?.name)) {
        throw createHttpError(401, 'INVALID_CREDENTIALS', 'Email or password is invalid');
      }
      if (err?.name === 'TooManyRequestsException') {
        throw createHttpError(429, 'PROVIDER_RATE_LIMITED', 'Authentication is temporarily unavailable');
      }
      if (err?.name === 'PasswordResetRequiredException') {
        throw createHttpError(409, 'PASSWORD_RESET_REQUIRED', 'A password reset is required');
      }
      throw createHttpError(503, 'PROVIDER_UNAVAILABLE', 'Authentication provider is unavailable');
    }

    if (response.ChallengeName) {
      throw createHttpError(409, 'AUTH_CHALLENGE_REQUIRED', 'Additional authentication is required');
    }

    const accessToken = response.AuthenticationResult?.AccessToken;
    const refreshToken = response.AuthenticationResult?.RefreshToken;
    const revokeRefreshToken = async () => {
      if (!refreshToken) return;
      const revokeInput = {
        Token: refreshToken,
        ClientId: clientId,
      };
      if (clientSecret) {
        revokeInput.ClientSecret = clientSecret;
      }
      try {
        await this.getAuthClient().send(new RevokeTokenCommand(revokeInput));
      } catch {
        throw createHttpError(503, 'PROVIDER_UNAVAILABLE', 'Unable to close the Cognito provider session');
      }
    };

    if (!accessToken) {
      await revokeRefreshToken();
      throw createHttpError(503, 'PROVIDER_INVALID_RESPONSE', 'Authentication provider returned an invalid response');
    }

    let identity;
    try {
      identity = await this.verifyAccessToken(accessToken, { clientId });
    } catch (err) {
      await revokeRefreshToken().catch(() => undefined);
      throw err;
    }
    await revokeRefreshToken();

    return {
      identity,
      accessTokenExpiresAt: new Date(identity.claims.exp * 1000),
    };
  }

  async deleteUser({ username }) {
    if (!username) {
      throw Object.assign(
        new Error('Cognito username is required before account deletion can complete'),
        {
          name: 'CognitoUsernameRequiredError',
          code: 'COGNITO_USERNAME_REQUIRED',
        },
      );
    }

    const input = {
      UserPoolId: this.userPoolId,
      Username: username,
    };
    const client = this.getAdminClient();
    let signedOut = false;

    try {
      await client.send(new AdminUserGlobalSignOutCommand(input));
      signedOut = true;
    } catch (err) {
      if (!isUserNotFoundError(err)) {
        throw err;
      }
    }

    try {
      await client.send(new AdminDeleteUserCommand(input));
      return { deleted: true, signedOut };
    } catch (err) {
      if (isUserNotFoundError(err)) {
        return { deleted: false, alreadyMissing: true, signedOut };
      }
      throw err;
    }
  }
}

export const cognitoIdentityProvider = new CognitoIdentityProvider();
