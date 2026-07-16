import { beforeEach, describe, expect, it, vi } from 'vitest';

const ADMIN_USER = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: 'Admin User',
  status: 'ACTIVE',
  activeDeletionRequest: null,
  cognitoSub: 'cognito-admin-sub',
  roles: ['ADMIN'],
  databaseRoles: ['ADMIN'],
};

const PROVIDER_RESULT = {
  identity: {
    provider: 'cognito',
    subject: 'cognito-admin-sub',
    tokenUse: 'access',
  },
  accessTokenExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
};

describe('AdminWebAuthService', () => {
  let identityProvider;
  let authService;
  let sessionStore;
  let service;

  beforeEach(async () => {
    vi.resetModules();
    identityProvider = {
      authenticatePassword: vi.fn().mockResolvedValue(PROVIDER_RESULT),
    };
    authService = {
      mapIdentityToUser: vi.fn().mockResolvedValue(ADMIN_USER),
    };
    sessionStore = {
      consumeLoginAttempt: vi.fn().mockResolvedValue({ allowed: true }),
      create: vi.fn().mockResolvedValue({
        token: 'opaque-session-token',
        expiresAt: PROVIDER_RESULT.accessTokenExpiresAt,
      }),
      read: vi.fn().mockResolvedValue({
        userId: ADMIN_USER.id,
        cognitoSubject: ADMIN_USER.cognitoSub,
        expiresAt: PROVIDER_RESULT.accessTokenExpiresAt,
      }),
      revoke: vi.fn().mockResolvedValue(undefined),
    };
    const { AdminWebAuthService } = await import('../../../src/services/adminWebAuth.js');
    service = new AdminWebAuthService({
      identityProvider,
      authService,
      sessionStore,
      config: {
        cognitoClientId: 'admin-web-client',
        cognitoClientSecret: 'admin-web-secret',
        loginRateLimitMax: 5,
        loginEmailRateLimitMax: 20,
        loginRateLimitWindowSeconds: 300,
      },
    });
  });

  it('creates a session only after Cognito verification and local admin authorization', async () => {
    await expect(service.login({
      email: 'Admin@Example.com ',
      password: 'correct-password',
      ipAddress: '127.0.0.1',
    })).resolves.toEqual({
      sessionToken: 'opaque-session-token',
      expiresAt: PROVIDER_RESULT.accessTokenExpiresAt.toISOString(),
      user: {
        id: ADMIN_USER.id,
        displayName: ADMIN_USER.displayName,
        roles: ['ADMIN'],
      },
    });

    expect(identityProvider.authenticatePassword).toHaveBeenCalledWith({
      username: 'admin@example.com',
      password: 'correct-password',
      clientId: 'admin-web-client',
      clientSecret: 'admin-web-secret',
    });
    expect(sessionStore.consumeLoginAttempt).toHaveBeenCalledWith({
      email: 'admin@example.com',
      ipAddress: '127.0.0.1',
      maxAttempts: 5,
      emailMaxAttempts: 20,
      windowSeconds: 300,
    });
    expect(authService.mapIdentityToUser).toHaveBeenCalledWith(
      PROVIDER_RESULT.identity,
      { allowProvision: false, enforceStatus: true },
    );
    expect(sessionStore.create).toHaveBeenCalledWith({
      userId: ADMIN_USER.id,
      cognitoSubject: ADMIN_USER.cognitoSub,
      expiresAt: PROVIDER_RESULT.accessTokenExpiresAt,
    });
  });

  it.each([
    ['ordinary user', { databaseRoles: ['USER'], roles: ['USER'] }, 'ADMIN_ACCESS_REQUIRED'],
    ['provider-group-only user', { databaseRoles: [], roles: ['ADMIN'] }, 'ADMIN_ACCESS_REQUIRED'],
    ['deletion-pending user', {
      activeDeletionRequest: {
        id: '22222222-2222-4222-8222-222222222222',
        status: 'REQUESTED',
      },
    }, 'DELETION_REQUEST_ACTIVE'],
  ])('rejects a %s before creating a session', async (_name, overrides, code) => {
    authService.mapIdentityToUser.mockResolvedValue({ ...ADMIN_USER, ...overrides });

    await expect(service.login({
      email: 'admin@example.com',
      password: 'correct-password',
      ipAddress: '127.0.0.1',
    })).rejects.toMatchObject({ code });

    expect(sessionStore.create).not.toHaveBeenCalled();
  });

  it('rejects throttled login before sending credentials to Cognito', async () => {
    sessionStore.consumeLoginAttempt.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 120,
    });

    await expect(service.login({
      email: 'admin@example.com',
      password: 'wrong-password',
      ipAddress: '127.0.0.1',
    })).rejects.toMatchObject({
      statusCode: 429,
      code: 'LOGIN_RATE_LIMITED',
    });

    expect(identityProvider.authenticatePassword).not.toHaveBeenCalled();
  });

  it.each([
    ['suspended account', { statusCode: 403, code: 'ACCOUNT_SUSPENDED' }],
    ['deleted account', { statusCode: 403, code: 'ACCOUNT_DELETED' }],
    ['database outage', new Error('database unavailable')],
  ])('fails login closed for a %s', async (_name, error) => {
    authService.mapIdentityToUser.mockRejectedValue(error);

    await expect(service.login({
      email: 'admin@example.com',
      password: 'correct-password',
      ipAddress: '127.0.0.1',
    })).rejects.toMatchObject(
      error instanceof Error ? { message: error.message } : error,
    );

    expect(sessionStore.create).not.toHaveBeenCalled();
  });

  it('revalidates the local user, subject, status, deletion state, and role on every read', async () => {
    await expect(service.validate('opaque-session-token')).resolves.toEqual({
      expiresAt: PROVIDER_RESULT.accessTokenExpiresAt.toISOString(),
      user: {
        id: ADMIN_USER.id,
        displayName: ADMIN_USER.displayName,
        roles: ['ADMIN'],
      },
    });

    expect(authService.mapIdentityToUser).toHaveBeenCalledWith({
      provider: 'admin-web-session',
      subject: ADMIN_USER.cognitoSub,
      localUserId: ADMIN_USER.id,
      tokenUse: 'session',
    }, {
      allowProvision: false,
      enforceStatus: true,
    });
  });

  it.each([
    ['role removal', { databaseRoles: ['USER'], roles: ['USER'] }, 'ADMIN_ACCESS_REQUIRED'],
    ['active deletion request', {
      activeDeletionRequest: {
        id: '22222222-2222-4222-8222-222222222222',
        status: 'PROCESSING',
      },
    }, 'DELETION_REQUEST_ACTIVE'],
    ['Cognito remapping', { cognitoSub: 'different-subject' }, 'ADMIN_SESSION_INVALID'],
  ])('revokes a session after %s', async (_name, overrides, code) => {
    authService.mapIdentityToUser.mockResolvedValue({ ...ADMIN_USER, ...overrides });

    await expect(service.validate('opaque-session-token')).rejects.toMatchObject({ code });
    expect(sessionStore.revoke).toHaveBeenCalledWith('opaque-session-token');
  });

  it('revokes logout idempotently', async () => {
    await expect(service.logout('opaque-session-token')).resolves.toBeUndefined();
    expect(sessionStore.revoke).toHaveBeenCalledWith('opaque-session-token');
  });

  it('preserves an existing session when local validation fails on infrastructure', async () => {
    authService.mapIdentityToUser.mockRejectedValue(new Error('database unavailable'));

    await expect(service.validate('opaque-session-token')).rejects.toThrow('database unavailable');
    expect(sessionStore.revoke).not.toHaveBeenCalled();
  });
});
