import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/services/favoriteService.js', () => ({
  listFavoriteRestaurants: vi.fn(),
  removeFavoriteRestaurant: vi.fn(),
  saveFavoriteRestaurant: vi.fn(),
}));

const favoriteService = await import('../../../src/services/favoriteService.js');
const {
  listFavoritesHandler,
  parseRestaurantIdParam,
  removeFavoriteHandler,
  saveFavoriteHandler,
} = await import('../../../src/controllers/favorite.js');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const RESTAURANT_ID = '33333333-3333-4333-8333-333333333333';

function mockReq(restaurantId = RESTAURANT_ID) {
  return {
    params: { restaurantId },
    user: { id: USER_ID },
  };
}

function mockRes() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe('favorite controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects invalid restaurant UUIDs before service execution', async () => {
    const res = mockRes();
    const next = vi.fn();

    await saveFavoriteHandler(mockReq('not-a-uuid'), res, next);

    expect(favoriteService.saveFavoriteRestaurant).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 422,
      code: 'VALIDATION_ERROR',
    }));
    expect(() => parseRestaurantIdParam('not-a-uuid')).toThrow();
  });

  it('returns 201 for a new save and 200 for an existing save', async () => {
    favoriteService.saveFavoriteRestaurant
      .mockResolvedValueOnce({ saved: true, created: true })
      .mockResolvedValueOnce({ saved: true, created: false });

    const createdRes = mockRes();
    await saveFavoriteHandler(mockReq(), createdRes, vi.fn());
    expect(createdRes.status).toHaveBeenCalledWith(201);
    expect(createdRes.json).toHaveBeenCalledWith({ saved: true });

    const existingRes = mockRes();
    await saveFavoriteHandler(mockReq(), existingRes, vi.fn());
    expect(existingRes.status).toHaveBeenCalledWith(200);
    expect(existingRes.json).toHaveBeenCalledWith({ saved: true });
  });

  it('scopes list and remove calls to the authenticated user', async () => {
    favoriteService.listFavoriteRestaurants.mockResolvedValue({ items: [] });
    favoriteService.removeFavoriteRestaurant.mockResolvedValue({ success: true });

    const listRes = mockRes();
    await listFavoritesHandler(mockReq(), listRes, vi.fn());
    expect(favoriteService.listFavoriteRestaurants).toHaveBeenCalledWith(USER_ID);
    expect(listRes.json).toHaveBeenCalledWith({ items: [] });

    const removeRes = mockRes();
    await removeFavoriteHandler(mockReq(), removeRes, vi.fn());
    expect(favoriteService.removeFavoriteRestaurant)
      .toHaveBeenCalledWith(USER_ID, RESTAURANT_ID);
    expect(removeRes.json).toHaveBeenCalledWith({ success: true });
  });
});
