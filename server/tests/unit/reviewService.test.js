import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/db.js', () => ({
  pool: {
    connect: vi.fn(),
    query: vi.fn(),
  },
}));

const { pool } = await import('../../src/config/db.js');
const { createReviewForVerificationIntent } = await import('../../src/services/reviewService.js');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const RESTAURANT_ID = '22222222-2222-4222-8222-222222222222';

function validPayload(overrides = {}) {
  return {
    restaurantId: RESTAURANT_ID,
    foodRating: 5,
    priceRating: 4,
    serviceRating: 5,
    ambienceRating: 4,
    comment: 'Đồ ăn ngon, phục vụ tốt, giá hợp lý và không gian rất sạch sẽ dễ chịu.',
    visitedAt: '2026-06-07T12:30:00+07:00',
    ...overrides,
  };
}

function createClient() {
  return {
    query: vi.fn(),
    release: vi.fn(),
  };
}

function mockHappyPath(client) {
  client.query
    .mockResolvedValueOnce({}) // BEGIN
    .mockResolvedValueOnce({ rows: [{ id: USER_ID, status: 'ACTIVE', review_restricted_until: null }], rowCount: 1 })
    .mockResolvedValueOnce({ rows: [{ id: RESTAURANT_ID, status: 'ACTIVE' }], rowCount: 1 })
    .mockResolvedValueOnce({ rows: [], rowCount: 0 })
    .mockResolvedValueOnce({ rows: [{ id: '33333333-3333-4333-8333-333333333333', status: 'SUBMITTED' }], rowCount: 1 })
    .mockResolvedValueOnce({}); // COMMIT
}

describe('createReviewForVerificationIntent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a submitted review and returns the upload receipt next step', async () => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    mockHappyPath(client);

    const result = await createReviewForVerificationIntent({
      userId: USER_ID,
      payload: validPayload(),
    });

    expect(result).toEqual({
      reviewId: '33333333-3333-4333-8333-333333333333',
      status: 'SUBMITTED',
      nextStep: 'UPLOAD_RECEIPT',
    });
    expect(client.query.mock.calls[4][0]).toContain('INSERT INTO reviews');
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  it('rejects missing or out-of-range ratings before opening a transaction', async () => {
    await expect(createReviewForVerificationIntent({
      userId: USER_ID,
      payload: validPayload({ foodRating: 6 }),
    })).rejects.toMatchObject({ statusCode: 422, code: 'VALIDATION_ERROR' });

    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('rejects comments shorter than 50 characters', async () => {
    await expect(createReviewForVerificationIntent({
      userId: USER_ID,
      payload: validPayload({ comment: 'Ngon.' }),
    })).rejects.toMatchObject({ statusCode: 422, code: 'VALIDATION_ERROR' });

    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('rejects future visitedAt values before opening a transaction', async () => {
    const futureVisitedAt = new Date(Date.now() + 60_000).toISOString();

    await expect(createReviewForVerificationIntent({
      userId: USER_ID,
      payload: validPayload({ visitedAt: futureVisitedAt }),
    })).rejects.toMatchObject({ statusCode: 422, code: 'VALIDATION_ERROR' });

    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('rejects inactive restaurants and rolls back', async () => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: USER_ID, status: 'ACTIVE', review_restricted_until: null }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id: RESTAURANT_ID, status: 'SUSPENDED' }], rowCount: 1 })
      .mockResolvedValueOnce({});

    await expect(createReviewForVerificationIntent({
      userId: USER_ID,
      payload: validPayload(),
    })).rejects.toMatchObject({ statusCode: 422, code: 'RESTAURANT_NOT_ACTIVE' });

    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
  });

  it('rejects merchants reviewing their own restaurant', async () => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: USER_ID, status: 'ACTIVE', review_restricted_until: null }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id: RESTAURANT_ID, status: 'ACTIVE' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }], rowCount: 1 })
      .mockResolvedValueOnce({});

    await expect(createReviewForVerificationIntent({
      userId: USER_ID,
      payload: validPayload(),
    })).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });

    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
  });
});
