import crypto from 'node:crypto';
import IORedis from 'ioredis';
import appConfig from '../config/app.js';
import { getRedisConnection } from '../config/redis.js';
import { HttpError, createHttpError } from '../utils/httpErrors.js';

const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,128}$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SESSION_PREFIX = 'trustbite:admin-web-session:';
const RATE_LIMIT_PREFIX = 'trustbite:admin-login-attempt:';
const CONSUME_RATE_LIMIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
local ttl = redis.call('TTL', KEYS[1])
if count == 1 or ttl < 0 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { count, ttl }
`;
let missingClientAddressWarningEmitted = false;

const createStoreUnavailableError = () => createHttpError(
  503,
  'SESSION_STORE_UNAVAILABLE',
  'Administrator session storage is unavailable',
);

const runRedisOperation = async (operation) => {
  try {
    return await operation();
  } catch (err) {
    if (err instanceof HttpError) {
      throw err;
    }
    throw createStoreUnavailableError();
  }
};

export class AdminWebSessionStore {
  constructor({
    redis,
    maxLifetimeSeconds,
    keySecret,
  }) {
    this.redis = redis;
    this.maxLifetimeSeconds = maxLifetimeSeconds;
    this.keySecret = keySecret;
  }

  assertConfigured() {
    if (!this.redis || !this.keySecret || !Number.isInteger(this.maxLifetimeSeconds)) {
      throw createHttpError(503, 'AUTH_NOT_CONFIGURED', 'Admin authentication is not configured');
    }
  }

  digest(value) {
    return crypto.createHmac('sha256', this.keySecret).update(value).digest('hex');
  }

  sessionKey(token) {
    return `${SESSION_PREFIX}${this.digest(token)}`;
  }

  assertToken(token) {
    if (typeof token !== 'string' || !SESSION_TOKEN_PATTERN.test(token)) {
      throw createHttpError(401, 'ADMIN_SESSION_INVALID', 'Administrator session is invalid');
    }
  }

  async create({ userId, cognitoSubject, expiresAt }) {
    this.assertConfigured();
    const providerExpiryMs = expiresAt instanceof Date ? expiresAt.getTime() : Number.NaN;
    const boundedExpiryMs = Math.min(
      providerExpiryMs,
      Date.now() + this.maxLifetimeSeconds * 1000,
    );
    const ttlSeconds = Math.floor((boundedExpiryMs - Date.now()) / 1000);
    if (
      !UUID_PATTERN.test(userId)
      || typeof cognitoSubject !== 'string'
      || !cognitoSubject
      || !Number.isFinite(boundedExpiryMs)
      || ttlSeconds <= 0
    ) {
      throw createHttpError(503, 'PROVIDER_INVALID_RESPONSE', 'Authentication expiry is invalid');
    }

    const token = crypto.randomBytes(32).toString('base64url');
    const session = JSON.stringify({
      version: 1,
      userId,
      cognitoSubject,
      expiresAt: boundedExpiryMs,
    });

    await runRedisOperation(() => this.redis.set(
      this.sessionKey(token),
      session,
      'EX',
      ttlSeconds,
    ));

    return {
      token,
      expiresAt: new Date(boundedExpiryMs),
    };
  }

  async read(token) {
    this.assertConfigured();
    this.assertToken(token);
    const key = this.sessionKey(token);
    const serialized = await runRedisOperation(() => this.redis.get(key));
    if (!serialized) {
      throw createHttpError(401, 'ADMIN_SESSION_INVALID', 'Administrator session is invalid');
    }

    let session;
    try {
      session = JSON.parse(serialized);
    } catch {
      await runRedisOperation(() => this.redis.del(key));
      throw createHttpError(401, 'ADMIN_SESSION_INVALID', 'Administrator session is invalid');
    }

    if (
      session?.version !== 1
      || !UUID_PATTERN.test(session.userId)
      || typeof session.cognitoSubject !== 'string'
      || !session.cognitoSubject
      || !Number.isFinite(session.expiresAt)
    ) {
      await runRedisOperation(() => this.redis.del(key));
      throw createHttpError(401, 'ADMIN_SESSION_INVALID', 'Administrator session is invalid');
    }

    if (session.expiresAt <= Date.now()) {
      await runRedisOperation(() => this.redis.del(key));
      throw createHttpError(401, 'ADMIN_SESSION_EXPIRED', 'Administrator session has expired');
    }

    return {
      userId: session.userId,
      cognitoSubject: session.cognitoSubject,
      expiresAt: new Date(session.expiresAt),
    };
  }

  async revoke(token) {
    this.assertConfigured();
    if (typeof token !== 'string' || !SESSION_TOKEN_PATTERN.test(token)) {
      return;
    }
    await runRedisOperation(() => this.redis.del(this.sessionKey(token)));
  }

  async consumeLoginAttempt({
    email,
    ipAddress,
    maxAttempts,
    emailMaxAttempts = maxAttempts * 4,
    windowSeconds,
  }) {
    this.assertConfigured();
    if (!ipAddress && !missingClientAddressWarningEmitted) {
      missingClientAddressWarningEmitted = true;
      console.warn(
        '[Admin Auth] Trusted client IP is unavailable; login throttling is limited to the email-wide policy.',
      );
    }

    return runRedisOperation(async () => {
      const consume = async (scope, fingerprint, limit) => {
        const key = `${RATE_LIMIT_PREFIX}${scope}:${fingerprint}`;
        const [count, retryAfterSeconds] = await this.redis.eval(
          CONSUME_RATE_LIMIT_SCRIPT,
          1,
          key,
          windowSeconds,
        );
        return { allowed: count <= limit, retryAfterSeconds };
      };

      const addressAttempt = ipAddress
        ? await consume(
          'address',
          this.digest(`${email}\n${ipAddress}`),
          maxAttempts,
        )
        : { allowed: true, retryAfterSeconds: 0 };
      const emailAttempt = await consume('email', this.digest(email), emailMaxAttempts);
      return {
        allowed: addressAttempt.allowed && emailAttempt.allowed,
        retryAfterSeconds: Math.max(
          addressAttempt.allowed ? 0 : addressAttempt.retryAfterSeconds,
          emailAttempt.allowed ? 0 : emailAttempt.retryAfterSeconds,
        ),
      };
    });
  }
}

let redis = null;
let adminWebSessionStore = null;

const getRedis = () => {
  if (!redis) {
    redis = new IORedis({
      ...getRedisConnection(),
      connectTimeout: 3000,
      maxRetriesPerRequest: 1,
    });
  }
  return redis;
};

export const getAdminWebSessionStore = () => {
  if (!adminWebSessionStore) {
    adminWebSessionStore = new AdminWebSessionStore({
      redis: getRedis(),
      maxLifetimeSeconds: appConfig.auth.adminWeb.sessionMaxSeconds,
      keySecret: appConfig.auth.adminWeb.sessionKeySecret,
    });
  }
  return adminWebSessionStore;
};

export const closeAdminWebSessionStore = async () => {
  if (redis) {
    redis.disconnect();
    redis = null;
  }
  adminWebSessionStore = null;
};
