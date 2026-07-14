import '../../helpers/env.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  validate: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('../../../src/services/adminWebAuth.js', () => ({
  adminWebAuthService: mocks,
}));

const originalBffSecret = process.env.ADMIN_WEB_BFF_SECRET;
let appConfig;
let app;

describe('admin web BFF routes', () => {
  beforeAll(async () => {
    process.env.ADMIN_WEB_BFF_SECRET = 'test-bff-secret';
    ({ default: appConfig } = await import('../../../src/config/app.js'));
    ({ default: app } = await import('../../../src/app.js'));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_WEB_BFF_SECRET = 'test-bff-secret';
    appConfig.auth.adminWeb.bffSecret = 'test-bff-secret';
  });

  afterAll(() => {
    if (originalBffSecret === undefined) {
      delete process.env.ADMIN_WEB_BFF_SECRET;
    } else {
      process.env.ADMIN_WEB_BFF_SECRET = originalBffSecret;
    }
  });

  it('rejects requests without the server-only BFF credential', async () => {
    const response = await request(app)
      .post('/api/v1/auth/admin/web-session')
      .send({ email: 'admin@example.com', password: 'password' })
      .expect(401);

    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.error.code).toBe('BFF_AUTH_REQUIRED');
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it('fails closed when the BFF credential is not configured', async () => {
    appConfig.auth.adminWeb.bffSecret = '';

    const response = await request(app)
      .get('/api/v1/auth/admin/web-session')
      .set('x-trustbite-bff-secret', 'test-bff-secret')
      .set('x-trustbite-admin-session', 'opaque-token')
      .expect(503);

    expect(response.body.error.code).toBe('AUTH_NOT_CONFIGURED');
    expect(mocks.validate).not.toHaveBeenCalled();
  });

  it('creates a no-store internal session response', async () => {
    mocks.login.mockResolvedValue({
      sessionToken: 'opaque-session-token',
      expiresAt: '2026-07-14T21:00:00.000Z',
      user: {
        id: '11111111-1111-4111-8111-111111111111',
        displayName: 'Admin User',
        roles: ['ADMIN'],
      },
    });

    const response = await request(app)
      .post('/api/v1/auth/admin/web-session')
      .set('x-trustbite-bff-secret', 'test-bff-secret')
      .set('x-trustbite-client-address', '203.0.113.10')
      .send({ email: 'admin@example.com', password: 'password' })
      .expect(201);

    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.sessionToken).toBe('opaque-session-token');
    expect(mocks.login).toHaveBeenCalledWith({
      email: 'admin@example.com',
      password: 'password',
      ipAddress: '203.0.113.10',
    });
  });

  it('does not substitute the shared BFF address when no client address is forwarded', async () => {
    mocks.login.mockResolvedValue({
      sessionToken: 'opaque-session-token',
      expiresAt: '2026-07-14T21:00:00.000Z',
      user: {
        id: '11111111-1111-4111-8111-111111111111',
        displayName: 'Admin User',
        roles: ['ADMIN'],
      },
    });

    await request(app)
      .post('/api/v1/auth/admin/web-session')
      .set('x-trustbite-bff-secret', 'test-bff-secret')
      .send({ email: 'admin@example.com', password: 'password' })
      .expect(201);

    expect(mocks.login).toHaveBeenCalledWith({
      email: 'admin@example.com',
      password: 'password',
      ipAddress: '',
    });
  });

  it('validates and revokes the provided opaque marker', async () => {
    mocks.validate.mockResolvedValue({
      expiresAt: '2026-07-14T21:00:00.000Z',
      user: {
        id: '11111111-1111-4111-8111-111111111111',
        displayName: 'Admin User',
        roles: ['ADMIN'],
      },
    });
    mocks.logout.mockResolvedValue(undefined);

    await request(app)
      .get('/api/v1/auth/admin/web-session')
      .set('x-trustbite-bff-secret', 'test-bff-secret')
      .set('x-trustbite-admin-session', 'opaque-session-token')
      .expect(200);
    await request(app)
      .delete('/api/v1/auth/admin/web-session')
      .set('x-trustbite-bff-secret', 'test-bff-secret')
      .set('x-trustbite-admin-session', 'opaque-session-token')
      .expect(204);

    expect(mocks.validate).toHaveBeenCalledWith('opaque-session-token');
    expect(mocks.logout).toHaveBeenCalledWith('opaque-session-token');
  });
});
