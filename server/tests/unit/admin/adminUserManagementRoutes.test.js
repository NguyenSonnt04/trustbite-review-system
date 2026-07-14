import '../../helpers/env.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  validateSession: vi.fn(),
  listUsers: vi.fn(),
  getUser: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock('../../../src/services/adminWebAuth.js', () => ({
  adminWebAuthService: {
    validate: mocks.validateSession,
  },
}));

vi.mock('../../../src/services/adminUserManagementService.js', () => ({
  adminUserManagementService: {
    listUsers: mocks.listUsers,
    getUser: mocks.getUser,
    createUser: mocks.createUser,
    updateUser: mocks.updateUser,
  },
}));

const originalBffSecret = process.env.ADMIN_WEB_BFF_SECRET;
let app;
let appConfig;

const sessionUser = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: 'Admin User',
  roles: ['ADMIN'],
};

describe('admin user management BFF routes', () => {
  beforeAll(async () => {
    process.env.ADMIN_WEB_BFF_SECRET = 'test-bff-secret';
    ({ default: appConfig } = await import('../../../src/config/app.js'));
    ({ default: app } = await import('../../../src/app.js'));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    appConfig.auth.adminWeb.bffSecret = 'test-bff-secret';
    mocks.validateSession.mockResolvedValue({
      expiresAt: '2026-07-15T12:00:00.000Z',
      user: sessionUser,
    });
  });

  afterAll(() => {
    if (originalBffSecret === undefined) {
      delete process.env.ADMIN_WEB_BFF_SECRET;
    } else {
      process.env.ADMIN_WEB_BFF_SECRET = originalBffSecret;
    }
  });

  it('validates the opaque session before returning a user list', async () => {
    mocks.listUsers.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
    });

    const response = await request(app)
      .get('/api/v1/admin-web/users?page=1&pageSize=20')
      .set('x-trustbite-bff-secret', 'test-bff-secret')
      .set('x-trustbite-admin-session', 'opaque-session-token')
      .expect(200);

    expect(response.headers['cache-control']).toBe('no-store');
    expect(mocks.validateSession).toHaveBeenCalledWith('opaque-session-token');
    expect(mocks.listUsers).toHaveBeenCalledWith(sessionUser, {
      page: '1',
      pageSize: '20',
    });
    expect(response.body).toMatchObject({ total: 0 });
  });

  it('creates a user through the validated admin session', async () => {
    const created = {
      id: '22222222-2222-4222-8222-222222222222',
      displayName: 'Created User',
      status: 'ACTIVE',
      roles: ['USER'],
    };
    mocks.createUser.mockResolvedValue(created);

    const response = await request(app)
      .post('/api/v1/admin-web/users')
      .set('x-trustbite-bff-secret', 'test-bff-secret')
      .set('x-trustbite-admin-session', 'opaque-session-token')
      .send({
        email: 'created@example.com',
        displayName: 'Created User',
        phoneNumber: '0912345678',
        dateOfBirth: '1990-01-01',
      })
      .expect(201);

    expect(mocks.createUser).toHaveBeenCalledWith(sessionUser, expect.objectContaining({
      email: 'created@example.com',
    }));
    expect(response.body).toEqual(created);
  });

  it('rejects invalid user ids before calling the service', async () => {
    const response = await request(app)
      .patch('/api/v1/admin-web/users/not-a-uuid')
      .set('x-trustbite-bff-secret', 'test-bff-secret')
      .set('x-trustbite-admin-session', 'opaque-session-token')
      .send({ displayName: 'Invalid Target' })
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
});
