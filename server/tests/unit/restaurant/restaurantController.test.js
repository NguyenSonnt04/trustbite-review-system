import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/services/restaurantService.js', () => ({
  getRestaurantDetail: vi.fn(),
  listPublicMenuItems: vi.fn(),
  publicRestaurantExists: vi.fn(),
}));

vi.mock('../../../src/services/reviewService.js', () => ({
  listPublicReviewsByRestaurant: vi.fn(),
}));

const restaurantService = await import('../../../src/services/restaurantService.js');
const reviewService = await import('../../../src/services/reviewService.js');
const {
  getRestaurantHandler,
  listRestaurantMenuHandler,
  listRestaurantReviewsHandler,
} = await import('../../../src/controllers/restaurant.js');

const VALID_RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';

function mockReq({ params = {}, query = {}, headers = {} } = {}) {
  return { params, query, headers };
}

function mockRes() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe('restaurant controller REST-US-003 boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when detail restaurantId is not a UUID', async () => {
    const req = mockReq({ params: { restaurantId: 'not-a-uuid' } });
    const res = mockRes();
    const next = vi.fn();

    await getRestaurantHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    });
    expect(restaurantService.getRestaurantDetail).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 when reviews restaurantId is not a UUID', async () => {
    const req = mockReq({ params: { restaurantId: 'not-a-uuid' } });
    const res = mockRes();
    const next = vi.fn();

    await listRestaurantReviewsHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    });
    expect(restaurantService.publicRestaurantExists).not.toHaveBeenCalled();
    expect(reviewService.listPublicReviewsByRestaurant).not.toHaveBeenCalled();
  });

  it('returns 400 when menu restaurantId is not a UUID', async () => {
    const req = mockReq({ params: { restaurantId: 'not-a-uuid' } });
    const res = mockRes();
    const next = vi.fn();

    await listRestaurantMenuHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    });
    expect(restaurantService.publicRestaurantExists).not.toHaveBeenCalled();
    expect(restaurantService.listPublicMenuItems).not.toHaveBeenCalled();
  });

  it('returns 422 when menu pageSize query is malformed', async () => {
    const req = mockReq({
      params: { restaurantId: VALID_RESTAURANT_ID },
      query: { pageSize: '50items' },
    });
    const res = mockRes();
    const next = vi.fn();

    await listRestaurantMenuHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(restaurantService.publicRestaurantExists).not.toHaveBeenCalled();
  });

  it('returns 404 when the restaurant is not public for menu access', async () => {
    restaurantService.publicRestaurantExists.mockResolvedValue(false);
    const req = mockReq({ params: { restaurantId: VALID_RESTAURANT_ID } });
    const res = mockRes();
    const next = vi.fn();

    await listRestaurantMenuHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(restaurantService.listPublicMenuItems).not.toHaveBeenCalled();
  });

  it('lists public menu items with parsed defaults', async () => {
    restaurantService.publicRestaurantExists.mockResolvedValue(true);
    restaurantService.listPublicMenuItems.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 50,
      total: 0,
    });
    const req = mockReq({ params: { restaurantId: VALID_RESTAURANT_ID } });
    const res = mockRes();
    const next = vi.fn();

    await listRestaurantMenuHandler(req, res, next);

    expect(restaurantService.listPublicMenuItems).toHaveBeenCalledWith(
      VALID_RESTAURANT_ID,
      { page: 1, pageSize: 50 },
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 422 when reviews status query is unsupported', async () => {
    const req = mockReq({
      params: { restaurantId: VALID_RESTAURANT_ID },
      query: { status: 'DRAFT' },
    });
    const res = mockRes();
    const next = vi.fn();

    await listRestaurantReviewsHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    });
    expect(restaurantService.publicRestaurantExists).not.toHaveBeenCalled();
  });

  it('returns 422 when reviews page query is malformed', async () => {
    const req = mockReq({
      params: { restaurantId: VALID_RESTAURANT_ID },
      query: { page: '1abc' },
    });
    const res = mockRes();
    const next = vi.fn();

    await listRestaurantReviewsHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    });
    expect(restaurantService.publicRestaurantExists).not.toHaveBeenCalled();
  });

  it('returns 422 when reviews pageSize query is malformed', async () => {
    const req = mockReq({
      params: { restaurantId: VALID_RESTAURANT_ID },
      query: { pageSize: '20xyz' },
    });
    const res = mockRes();
    const next = vi.fn();

    await listRestaurantReviewsHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    });
    expect(restaurantService.publicRestaurantExists).not.toHaveBeenCalled();
  });

  it('returns 404 when the restaurant is not public for reviews', async () => {
    restaurantService.publicRestaurantExists.mockResolvedValue(false);

    const req = mockReq({ params: { restaurantId: VALID_RESTAURANT_ID } });
    const res = mockRes();
    const next = vi.fn();

    await listRestaurantReviewsHandler(req, res, next);

    expect(restaurantService.publicRestaurantExists).toHaveBeenCalledWith(VALID_RESTAURANT_ID);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.objectContaining({ code: 'NOT_FOUND' }),
    });
    expect(reviewService.listPublicReviewsByRestaurant).not.toHaveBeenCalled();
  });

  it('calls public review service with parsed defaults for a valid reviews request', async () => {
    restaurantService.publicRestaurantExists.mockResolvedValue(true);
    reviewService.listPublicReviewsByRestaurant.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
    });

    const req = mockReq({ params: { restaurantId: VALID_RESTAURANT_ID } });
    const res = mockRes();
    const next = vi.fn();

    await listRestaurantReviewsHandler(req, res, next);

    expect(reviewService.listPublicReviewsByRestaurant).toHaveBeenCalledWith(VALID_RESTAURANT_ID, {
      status: 'ALL',
      page: 1,
      pageSize: 20,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ items: [], page: 1, pageSize: 20, total: 0 });
  });
});
