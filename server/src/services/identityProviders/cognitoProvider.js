import crypto from 'node:crypto';
import appConfig from '../../config/app.js';
import { createHttpError } from '../../utils/httpErrors.js';

let cachedJwks = null;
let cachedAt = 0;
let pendingJwksFetch = null;
let lastUnknownKidRefreshAt = null;
const JWKS_TTL_MS = 60 * 60 * 1000;
const UNKNOWN_KID_REFRESH_COOLDOWN_MS = 30 * 1000;

const isJwkObject = (key) => Boolean(key) && typeof key === 'object' && !Array.isArray(key);

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

const validateAccessTokenClaims = (payload) => {
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
  if (payload.client_id !== config.clientId) {
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

  async verifyAccessToken(token) {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw createHttpError(401, 'INVALID_TOKEN', 'Malformed JWT');
    }

    const header = parseJsonPart(parts[0], 'header');
    const payload = parseJsonPart(parts[1], 'payload');

    await verifySignature(token, header);
    validateAccessTokenClaims(payload);

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
}

export const cognitoIdentityProvider = new CognitoIdentityProvider();
