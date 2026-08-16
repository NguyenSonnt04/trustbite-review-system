import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  validateSession: vi.fn(),
  listRestaurants: vi.fn(),
  getRestaurant: vi.fn(),
  updateRestaurant: vi.fn(),
  deleteRestaurants: vi.fn(),
  listMenuItems: vi.fn(),
  createMenuItem: vi.fn(),
  updateMenuItem: vi.fn(),
  uploadImage: vi.fn(),
  updateImage: vi.fn(),
  replaceImage: vi.fn(),
  deleteImage: vi.fn(),
  publicRestaurantExists: vi.fn(),
  listPublicReviews: vi.fn(),
}));

vi.mock('../../../src/services/adminWebAuth.js', () => ({
  adminWebAuthService: {
    validate: mocks.validateSession,
  },
}));

vi.mock('../../../src/services/adminRestaurantManagementService.js', () => ({
  adminRestaurantManagementService: {
    listRestaurants: mocks.listRestaurants,
    getRestaurant: mocks.getRestaurant,
    updateRestaurant: mocks.updateRestaurant,
    deleteRestaurants: mocks.deleteRestaurants,
    listMenuItems: mocks.listMenuItems,
    createMenuItem: mocks.createMenuItem,
    updateMenuItem: mocks.updateMenuItem,
  },
}));

vi.mock('../../../src/services/restaurantImageService.js', () => ({
  uploadRestaurantImage: mocks.uploadImage,
  updateRestaurantImage: mocks.updateImage,
  replaceRestaurantImage: mocks.replaceImage,
  deleteRestaurantImage: mocks.deleteImage,
}));

vi.mock('../../../src/services/restaurantService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  publicRestaurantExists: mocks.publicRestaurantExists,
}));

vi.mock('../../../src/services/reviewService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  listPublicReviewsByRestaurant: mocks.listPublicReviews,
}));

const originalBffSecret = process.env.ADMIN_WEB_BFF_SECRET;
let app;
let appConfig;

const sessionUser = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: 'Admin User',
  roles: ['ADMIN'],
};
const restaurantId = '22222222-2222-4222-8222-222222222222';

describe('admin restaurant management BFF routes', () => {
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
    mocks.publicRestaurantExists.mockResolvedValue(true);
    mocks.listPublicReviews.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
    });
  });

  afterAll(() => {
    if (originalBffSecret === undefined) {
      delete process.env.ADMIN_WEB_BFF_SECRET;
    } else {
      process.env.ADMIN_WEB_BFF_SECRET = originalBffSecret;
    }
  });

  it('lists non-public restaurant records through the validated admin session', async () => {
    mocks.listRestaurants.mockResolvedValue({
      items: [{ id: restaurantId, name: 'Draft Restaurant', status: 'DRAFT' }],
      page: 1,
      pageSize: 20,
      total: 1,
    });

    const response = await request(app)
      .get('/api/v1/admin-web/restaurants?status=DRAFT')
      .set('x-trustbite-bff-secret', 'test-bff-secret')
      .set('x-trustbite-admin-session', 'opaque-session-token')
      .expect(200);

    expect(mocks.validateSession).toHaveBeenCalledWith('opaque-session-token');
    expect(mocks.listRestaurants).toHaveBeenCalledWith(sessionUser, { status: 'DRAFT' });
    expect(response.body.total).toBe(1);
  });

  it('updates a restaurant profile through the admin boundary', async () => {
    mocks.updateRestaurant.mockResolvedValue({
      id: restaurantId,
      name: 'Updated Restaurant',
      status: 'ACTIVE',
    });

    const response = await request(app)
      .patch(`/api/v1/admin-web/restaurants/${restaurantId}`)
      .set('x-trustbite-bff-secret', 'test-bff-secret')
      .set('x-trustbite-admin-session', 'opaque-session-token')
      .send({ name: 'Updated Restaurant', reason: 'Verified admin correction' })
      .expect(200);

    expect(mocks.updateRestaurant).toHaveBeenCalledWith(
      sessionUser,
      restaurantId,
      expect.objectContaining({ name: 'Updated Restaurant' }),
    );
    expect(response.body.name).toBe('Updated Restaurant');
  });
  it('lists and creates menu items through the admin boundary', async () => {
    mocks.listMenuItems.mockResolvedValue({
      items: [{ id: '33333333-3333-4333-8333-333333333333', name: 'Phở bò' }],
      page: 1,
      pageSize: 100,
      total: 1,
    });
    mocks.createMenuItem.mockResolvedValue({
      id: '44444444-4444-4444-8444-444444444444',
      restaurantId,
      name: 'Bún bò',
      price: 65000,
      currency: 'VND',
      status: 'ACTIVE',
    });

    const listResponse = await request(app)
      .get(`/api/v1/admin-web/restaurants/${restaurantId}/menu?pageSize=100`)
      .set('x-trustbite-bff-secret', 'test-bff-secret')
      .set('x-trustbite-admin-session', 'opaque-session-token')
      .expect(200);

    expect(mocks.listMenuItems).toHaveBeenCalledWith(
      sessionUser,
      restaurantId,
      { pageSize: '100' },
    );
    expect(listResponse.body.total).toBe(1);

    const createResponse = await request(app)
      .post(`/api/v1/admin-web/restaurants/${restaurantId}/menu`)
      .set('x-trustbite-bff-secret', 'test-bff-secret')
      .set('x-trustbite-admin-session', 'opaque-session-token')
      .send({
        name: 'Bún bò',
        price: 65000,
        currency: 'VND',
        reason: 'Thêm món theo thực đơn đã xác minh',
      })
      .expect(201);

    expect(mocks.createMenuItem).toHaveBeenCalledWith(
      sessionUser,
      restaurantId,
      expect.objectContaining({ name: 'Bún bò', price: 65000 }),
    );
    expect(createResponse.body.name).toBe('Bún bò');
  });

  it('updates a menu item and rejects malformed item ids', async () => {
    const menuItemId = '33333333-3333-4333-8333-333333333333';
    mocks.updateMenuItem.mockResolvedValue({
      id: menuItemId,
      restaurantId,
      name: 'Phở bò đặc biệt',
      price: 79000,
      currency: 'VND',
      status: 'ACTIVE',
    });

    const response = await request(app)
      .patch(`/api/v1/admin-web/restaurants/${restaurantId}/menu/${menuItemId}`)
      .set('x-trustbite-bff-secret', 'test-bff-secret')
      .set('x-trustbite-admin-session', 'opaque-session-token')
      .send({
        price: 79000,
        reason: 'Cập nhật giá theo thực đơn mới',
      })
      .expect(200);

    expect(mocks.updateMenuItem).toHaveBeenCalledWith(
      sessionUser,
      restaurantId,
      menuItemId,
      expect.objectContaining({ price: 79000 }),
    );
    expect(response.body.price).toBe(79000);

    await request(app)
      .patch(`/api/v1/admin-web/restaurants/${restaurantId}/menu/not-a-uuid`)
      .set('x-trustbite-bff-secret', 'test-bff-secret')
      .set('x-trustbite-admin-session', 'opaque-session-token')
      .send({ status: 'ARCHIVED', reason: 'Ẩn món không còn phục vụ' })
      .expect(400);

    expect(mocks.updateMenuItem).toHaveBeenCalledTimes(1);
=======
  it('lists restaurant reviews only through a validated admin session', async () => {
    await request(app)
      .get(`/api/v1/admin-web/restaurants/${restaurantId}/reviews`)
      .query({ status: 'ALL', page: 1, pageSize: 10 })
      .expect(401);

    const response = await request(app)
      .get(`/api/v1/admin-web/restaurants/${restaurantId}/reviews`)
      .set('x-trustbite-bff-secret', 'test-bff-secret')
      .set('x-trustbite-admin-session', 'opaque-session-token')
      .query({ status: 'ALL', page: 1, pageSize: 10 })
      .expect(200);

    expect(mocks.validateSession).toHaveBeenCalledWith('opaque-session-token');
    expect(mocks.publicRestaurantExists).toHaveBeenCalledWith(restaurantId);
    expect(mocks.listPublicReviews).toHaveBeenCalledWith(restaurantId, {
      status: 'ALL',
      page: 1,
      pageSize: 10,
    });
    expect(response.body).toMatchObject({ items: [], total: 0 });
  });

  it('soft-deletes selected restaurants through the admin boundary', async () => {
    const secondRestaurantId = '33333333-3333-4333-8333-333333333333';
    const idempotencyKey = '44444444-4444-4444-8444-444444444444';
    mocks.deleteRestaurants.mockResolvedValue({
      statusCode: 200,
      replayed: false,
      body: {
        deletedIds: [restaurantId, secondRestaurantId],
        deletedCount: 2,
      },
    });

    const response = await request(app)
      .post('/api/v1/admin-web/restaurants/bulk-delete')
      .set('x-trustbite-bff-secret', 'test-bff-secret')
      .set('x-trustbite-admin-session', 'opaque-session-token')
      .set('idempotency-key', idempotencyKey)
      .send({
        restaurantIds: [restaurantId, secondRestaurantId],
        reason: 'Confirmed duplicate restaurant records',
      })
      .expect(200);

    expect(mocks.deleteRestaurants).toHaveBeenCalledWith(
      sessionUser,
      expect.objectContaining({
        restaurantIds: [restaurantId, secondRestaurantId],
        reason: 'Confirmed duplicate restaurant records',
      }),
      idempotencyKey,
    );
    expect(response.body.deletedCount).toBe(2);
  });

  it('forwards one validated multipart restaurant image', async () => {
    mocks.uploadImage.mockResolvedValue({
      statusCode: 201,
      replayed: false,
      body: {
        id: '33333333-3333-4333-8333-333333333333',
        restaurantId,
        imageUrl: 'https://example.com/signed-image',
      },
    });

    const response = await request(app)
      .post(`/api/v1/admin-web/restaurants/${restaurantId}/images`)
      .set('x-trustbite-bff-secret', 'test-bff-secret')
      .set('x-trustbite-admin-session', 'opaque-session-token')
      .set('idempotency-key', '44444444-4444-4444-8444-444444444444')
      .field('caption', 'Front view')
      .field('isPrimary', 'true')
      .attach('restaurantImage', Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]), { filename: 'front.png', contentType: 'image/png' })
      .expect(201);

    expect(mocks.uploadImage).toHaveBeenCalledWith(expect.objectContaining({
      userId: sessionUser.id,
      restaurantId,
      fields: expect.objectContaining({ caption: 'Front view', isPrimary: 'true' }),
      file: expect.objectContaining({ originalname: 'front.png', mimetype: 'image/png' }),
    }));
    expect(response.body.restaurantId).toBe(restaurantId);
  });

  it('rejects invalid restaurant ids before calling services', async () => {
    const response = await request(app)
      .get('/api/v1/admin-web/restaurants/not-a-uuid')
      .set('x-trustbite-bff-secret', 'test-bff-secret')
      .set('x-trustbite-admin-session', 'opaque-session-token')
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(mocks.getRestaurant).not.toHaveBeenCalled();
  });
});
