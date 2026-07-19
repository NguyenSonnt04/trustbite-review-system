import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/config/db.js', () => ({
  pool: {
    connect: vi.fn(),
    query: vi.fn(),
  },
}));

vi.mock('../../../src/services/s3RestaurantImageStorageService.js', () => ({
  resolveRestaurantImageUrl: vi.fn(async (reference) => (
    reference ? `resolved:${reference}` : null
  )),
}));

const { pool } = await import('../../../src/config/db.js');
const {
  listFavoriteRestaurants,
  removeFavoriteRestaurant,
  saveFavoriteRestaurant,
} = await import('../../../src/services/favoriteService.js');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';
const RESTAURANT_ID = '33333333-3333-4333-8333-333333333333';
const LIST_ID = '44444444-4444-4444-8444-444444444444';

function createClient() {
  return {
    query: vi.fn(),
    release: vi.fn(),
  };
}

describe('favoriteService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates the private default list under a per-user transaction lock and saves once', async () => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({}) // advisory lock
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: RESTAURANT_ID }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] }) // no default list
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: LIST_ID }] }) // create list
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ restaurant_id: RESTAURANT_ID }] })
      .mockResolvedValueOnce({}); // COMMIT

    await expect(saveFavoriteRestaurant(USER_ID, RESTAURANT_ID))
      .resolves.toEqual({ saved: true, created: true });

    expect(client.query.mock.calls[1][0]).toContain('pg_advisory_xact_lock');
    expect(client.query.mock.calls[1][1]).toEqual([USER_ID]);
    expect(client.query.mock.calls[4][0]).toContain('INSERT INTO user_saved_lists');
    expect(client.query.mock.calls[4][1]).toEqual([USER_ID, 'Yêu thích']);
    expect(client.query.mock.calls[5][0]).toContain('ON CONFLICT (saved_list_id, restaurant_id) DO NOTHING');
    expect(client.query.mock.calls[5][1]).toEqual([LIST_ID, RESTAURANT_ID]);
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
  });

  it('returns an idempotent existing result without creating another default list', async () => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: RESTAURANT_ID }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: LIST_ID }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({});

    await expect(saveFavoriteRestaurant(USER_ID, RESTAURANT_ID))
      .resolves.toEqual({ saved: true, created: false });

    expect(client.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO user_saved_lists'))).toBe(false);
  });

  it('rejects a missing, deleted, or inactive restaurant and rolls back without creating a list', async () => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({});

    await expect(saveFavoriteRestaurant(USER_ID, RESTAURANT_ID))
      .rejects.toMatchObject({ statusCode: 404, code: 'RESTAURANT_NOT_FOUND' });

    expect(client.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO user_saved_lists'))).toBe(false);
    expect(client.query.mock.calls[2][0]).toContain("status = 'ACTIVE'");
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
  });

  it('lists only the authenticated user favorites newest first as mobile restaurant cards', async () => {
    const addedAt = new Date('2026-07-19T10:00:00.000Z');
    pool.query.mockResolvedValue({
      rows: [{
        id: RESTAURANT_ID,
        name: 'Phở thật',
        primary_image_url: 's3://restaurant-images/example.webp',
        trust_score: '4.70',
        verified_review_count: 8,
        added_at: addedAt,
      }],
    });

    await expect(listFavoriteRestaurants(USER_ID)).resolves.toEqual({
      items: [{
        id: RESTAURANT_ID,
        name: 'Phở thật',
        primaryImageUrl: 'resolved:s3://restaurant-images/example.webp',
        trustScore: 4.7,
        verifiedReviewCount: 8,
        addedAt,
      }],
    });

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('list.user_id = $1');
    expect(sql).toContain('restaurant.is_deleted = FALSE');
    expect(sql).toContain("restaurant.status = 'ACTIVE'");
    expect(sql).toContain('ORDER BY saved.added_at DESC');
    expect(params).toEqual([USER_ID, 'Yêu thích']);
    expect(params).not.toContain(OTHER_USER_ID);
  });

  it('removes only from the authenticated user default list and remains idempotent', async () => {
    pool.query.mockResolvedValue({ rowCount: 0, rows: [] });

    await expect(removeFavoriteRestaurant(USER_ID, RESTAURANT_ID))
      .resolves.toEqual({ success: true });

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('list.user_id = $1');
    expect(sql).toContain('list.name = $3');
    expect(params).toEqual([USER_ID, RESTAURANT_ID, 'Yêu thích']);
  });
});
