import '../helpers/env.js';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const originalEnv = {
  ADMIN_WEB_BFF_SECRET: process.env.ADMIN_WEB_BFF_SECRET,
  ADMIN_WEB_SESSION_KEY_SECRET: process.env.ADMIN_WEB_SESSION_KEY_SECRET,
  ADMIN_WEB_SESSION_MAX_SECONDS: process.env.ADMIN_WEB_SESSION_MAX_SECONDS,
  ADMIN_LOGIN_RATE_LIMIT_MAX: process.env.ADMIN_LOGIN_RATE_LIMIT_MAX,
  ADMIN_LOGIN_RATE_LIMIT_WINDOW_SECONDS: process.env.ADMIN_LOGIN_RATE_LIMIT_WINDOW_SECONDS,
  AWS_COGNITO_ADMIN_WEB_CLIENT_ID: process.env.AWS_COGNITO_ADMIN_WEB_CLIENT_ID,
  AWS_COGNITO_ADMIN_WEB_CLIENT_SECRET: process.env.AWS_COGNITO_ADMIN_WEB_CLIENT_SECRET,
};

let closeAdminWebSessionStore;
let closeDbPool;
let cognitoIdentityProvider;
let createUser;
let query;
let requestApp;

const createdRoleIds = new Set();

async function ensureRole(roleId) {
  const result = await query(
    `INSERT INTO roles (id, label, description)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    [roleId, roleId, `${roleId} test role`],
  );
  if (result.rowCount > 0) createdRoleIds.add(roleId);
}

async function assignRole(userId, roleId) {
  await ensureRole(roleId);
  await query(
    `INSERT INTO user_roles (user_id, role_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, role_id) DO NOTHING`,
    [userId, roleId],
  );
}

async function cleanupUser(userId) {
  await query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);
  await query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
  await query('DELETE FROM users WHERE id = $1', [userId]);
}

function restoreEnvironment() {
  for (const [name, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

describe('admin web authentication API', () => {
  beforeAll(async () => {
    process.env.ADMIN_WEB_BFF_SECRET = 'integration-bff-secret';
    process.env.ADMIN_WEB_SESSION_KEY_SECRET = 'integration-session-key-secret';
    process.env.ADMIN_WEB_SESSION_MAX_SECONDS = '900';
    process.env.ADMIN_LOGIN_RATE_LIMIT_MAX = '20';
    process.env.ADMIN_LOGIN_RATE_LIMIT_WINDOW_SECONDS = '60';
    process.env.AWS_COGNITO_ADMIN_WEB_CLIENT_ID = 'integration-admin-client';
    process.env.AWS_COGNITO_ADMIN_WEB_CLIENT_SECRET = 'integration-admin-secret';

    ({ closeAdminWebSessionStore } = await import(
      '../../src/services/adminWebSessionStore.js'
    ));
    ({ cognitoIdentityProvider } = await import(
      '../../src/services/identityProviders/cognitoProvider.js'
    ));
    ({ createUser } = await import('../helpers/factories/index.js'));
    ({ closeDbPool, query } = await import('../helpers/db.js'));
    ({ requestApp } = await import('../helpers/http.js'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    try {
      if (createdRoleIds.size > 0) {
        await query(
          `DELETE FROM roles r
           WHERE r.id = ANY($1::varchar[])
             AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.role_id = r.id)`,
          [[...createdRoleIds]],
        );
      }
    } finally {
      restoreEnvironment();
      await closeAdminWebSessionStore();
      await closeDbPool();
    }
  });

  it('creates, revalidates, role-revokes, and rejects a fixed admin web session', async () => {
    const user = await createUser({ displayName: 'Web Admin' });
    const cognitoSubject = `web-admin-${user.id}`;
    await query('UPDATE users SET cognito_sub = $1 WHERE id = $2', [cognitoSubject, user.id]);
    await assignRole(user.id, 'ADMIN');

    vi.spyOn(cognitoIdentityProvider, 'authenticatePassword').mockResolvedValue({
      identity: {
        provider: 'cognito',
        subject: cognitoSubject,
        tokenUse: 'access',
      },
      accessTokenExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    try {
      const login = await requestApp()
        .post('/api/v1/auth/admin/web-session')
        .set('x-trustbite-bff-secret', 'integration-bff-secret')
        .send({ email: 'admin@example.com', password: 'correct-password' })
        .expect(201);

      expect(login.headers['cache-control']).toBe('no-store');
      expect(login.body).toMatchObject({
        sessionToken: expect.any(String),
        expiresAt: expect.any(String),
        user: {
          id: user.id,
          displayName: 'Web Admin',
          roles: ['ADMIN'],
        },
      });
      expect(JSON.stringify(login.body)).not.toContain('correct-password');
      expect(JSON.stringify(login.body)).not.toContain('access-token');

      const sessionHeader = {
        'x-trustbite-bff-secret': 'integration-bff-secret',
        'x-trustbite-admin-session': login.body.sessionToken,
      };
      await requestApp()
        .get('/api/v1/auth/admin/web-session')
        .set(sessionHeader)
        .expect(200);

      await query('DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2', [user.id, 'ADMIN']);
      const roleRemoved = await requestApp()
        .get('/api/v1/auth/admin/web-session')
        .set(sessionHeader)
        .expect(403);
      expect(roleRemoved.body.error.code).toBe('ADMIN_ACCESS_REQUIRED');

      const revoked = await requestApp()
        .get('/api/v1/auth/admin/web-session')
        .set(sessionHeader)
        .expect(401);
      expect(revoked.body.error.code).toBe('ADMIN_SESSION_INVALID');
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('rejects a Cognito-authenticated user without a local administrator role', async () => {
    const user = await createUser({ displayName: 'Plain Web User' });
    const cognitoSubject = `plain-web-${user.id}`;
    await query('UPDATE users SET cognito_sub = $1 WHERE id = $2', [cognitoSubject, user.id]);

    vi.spyOn(cognitoIdentityProvider, 'authenticatePassword').mockResolvedValue({
      identity: {
        provider: 'cognito',
        subject: cognitoSubject,
        tokenUse: 'access',
        providerGroups: ['ADMIN'],
      },
      accessTokenExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    try {
      const response = await requestApp()
        .post('/api/v1/auth/admin/web-session')
        .set('x-trustbite-bff-secret', 'integration-bff-secret')
        .send({ email: 'plain@example.com', password: 'correct-password' })
        .expect(403);
      expect(response.body.error.code).toBe('ADMIN_ACCESS_REQUIRED');
    } finally {
      await cleanupUser(user.id);
    }
  });
});
