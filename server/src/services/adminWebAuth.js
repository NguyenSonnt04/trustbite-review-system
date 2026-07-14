import { authService } from './auth.js';
import { cognitoIdentityProvider } from './identityProviders/cognitoProvider.js';
import { getAdminWebSessionStore } from './adminWebSessionStore.js';
import appConfig from '../config/app.js';
import { createHttpError, HttpError } from '../utils/httpErrors.js';

const ADMIN_ROLES = new Set(['ADMIN', 'SUPER_ADMIN']);
const SESSION_INVALIDATING_STATUS_CODES = new Set([401, 403, 409]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

const normalizeRoles = (roles = []) => [...new Set(
  roles.map((role) => String(role).trim().toUpperCase()).filter(Boolean),
)];

const mapSessionUser = (user) => ({
  id: user.id,
  displayName: user.displayName,
  roles: normalizeRoles(user.databaseRoles).filter((role) => ADMIN_ROLES.has(role)),
});

const assertAdminAccount = (user, expectedSubject) => {
  if (user.activeDeletionRequest) {
    throw createHttpError(409, 'DELETION_REQUEST_ACTIVE', 'Account deletion request is active');
  }

  if (!user.cognitoSub || user.cognitoSub !== expectedSubject) {
    throw createHttpError(401, 'ADMIN_SESSION_INVALID', 'Administrator session is invalid');
  }

  const databaseRoles = normalizeRoles(user.databaseRoles);
  if (!databaseRoles.some((role) => ADMIN_ROLES.has(role))) {
    throw createHttpError(403, 'ADMIN_ACCESS_REQUIRED', 'Administrator access is required');
  }
};

const normalizeEmail = (email) => {
  if (typeof email !== 'string') {
    throw createHttpError(422, 'VALIDATION_ERROR', 'email must be a string');
  }
  const normalized = email.trim().toLowerCase();
  if (!normalized || normalized.length > 254 || !EMAIL_PATTERN.test(normalized)) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'email must be a valid email address');
  }
  return normalized;
};

const validatePassword = (password) => {
  if (typeof password !== 'string' || password.length === 0 || password.length > 1024) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'password is required');
  }
  return password;
};

export class AdminWebAuthService {
  constructor({
    identityProvider = cognitoIdentityProvider,
    authService: localAuthService = authService,
    sessionStore = null,
    config = appConfig.auth.adminWeb,
  } = {}) {
    this.identityProvider = identityProvider;
    this.authService = localAuthService;
    this.sessionStore = sessionStore;
    this.config = config;
  }

  getSessionStore() {
    return this.sessionStore || getAdminWebSessionStore();
  }

  assertConfigured() {
    if (
      !this.config.cognitoClientId
      || !this.config.cognitoClientSecret
      || !Number.isInteger(this.config.loginRateLimitMax)
      || this.config.loginRateLimitMax <= 0
      || !Number.isInteger(this.config.loginEmailRateLimitMax)
      || this.config.loginEmailRateLimitMax <= 0
      || !Number.isInteger(this.config.loginRateLimitWindowSeconds)
      || this.config.loginRateLimitWindowSeconds <= 0
    ) {
      throw createHttpError(503, 'AUTH_NOT_CONFIGURED', 'Admin authentication is not configured');
    }
  }

  async login({ email, password, ipAddress }) {
    this.assertConfigured();
    const normalizedEmail = normalizeEmail(email);
    const validatedPassword = validatePassword(password);
    const sessionStore = this.getSessionStore();
    const attempt = await sessionStore.consumeLoginAttempt({
      email: normalizedEmail,
      ipAddress,
      maxAttempts: this.config.loginRateLimitMax,
      emailMaxAttempts: this.config.loginEmailRateLimitMax,
      windowSeconds: this.config.loginRateLimitWindowSeconds,
    });
    if (!attempt.allowed) {
      throw createHttpError(
        429,
        'LOGIN_RATE_LIMITED',
        'Too many login attempts. Try again later.',
        { retryAfterSeconds: attempt.retryAfterSeconds },
      );
    }

    const providerResult = await this.identityProvider.authenticatePassword({
      username: normalizedEmail,
      password: validatedPassword,
      clientId: this.config.cognitoClientId,
      clientSecret: this.config.cognitoClientSecret,
    });
    const user = await this.authService.mapIdentityToUser(providerResult.identity, {
      allowProvision: false,
      enforceStatus: true,
    });
    assertAdminAccount(user, providerResult.identity.subject);

    const session = await sessionStore.create({
      userId: user.id,
      cognitoSubject: providerResult.identity.subject,
      expiresAt: providerResult.accessTokenExpiresAt,
    });

    return {
      sessionToken: session.token,
      expiresAt: session.expiresAt.toISOString(),
      user: mapSessionUser(user),
    };
  }

  async validate(token) {
    const sessionStore = this.getSessionStore();
    const session = await sessionStore.read(token);
    try {
      const user = await this.authService.mapIdentityToUser({
        provider: 'admin-web-session',
        subject: session.cognitoSubject,
        localUserId: session.userId,
        tokenUse: 'session',
      }, {
        allowProvision: false,
        enforceStatus: true,
      });
      assertAdminAccount(user, session.cognitoSubject);

      return {
        expiresAt: session.expiresAt.toISOString(),
        user: mapSessionUser(user),
      };
    } catch (err) {
      if (
        err instanceof HttpError
        && SESSION_INVALIDATING_STATUS_CODES.has(err.statusCode)
      ) {
        await sessionStore.revoke(token).catch(() => {});
      }
      throw err;
    }
  }

  async logout(token) {
    await this.getSessionStore().revoke(token);
  }
}

export const adminWebAuthService = new AdminWebAuthService();
