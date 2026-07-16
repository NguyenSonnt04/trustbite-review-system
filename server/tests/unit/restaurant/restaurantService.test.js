import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/config/db.js', () => ({
  pool: {
    query: vi.fn(),
  },
}));

vi.mock('../../../src/services/s3RestaurantImageStorageService.js', () => ({
  resolveRestaurantImageUrl: vi.fn(),
}));

const { pool } = await import('../../../src/config/db.js');
const { resolveRestaurantImageUrl } = await import(
  '../../../src/services/s3RestaurantImageStorageService.js'
);
const { listRestaurants } = await import(
  '../../../src/services/restaurantService.js'
);

describe('restaurantService public image delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns restaurant data with a null image when URL signing fails', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Provider-safe restaurant',
          slug: 'provider-safe-restaurant',
          description: null,
          phone_number: null,
          address: null,
          latitude: null,
          longitude: null,
          status: 'ACTIVE',
          trust_score: '4.50',
          verified_review_count: 2,
          reference_review_count: 1,
          category_ids: [],
          primary_image_url: 's3://trustbite-restaurant-images/image.jpg',
          created_at: new Date('2026-07-16T00:00:00.000Z'),
          updated_at: new Date('2026-07-16T00:00:00.000Z'),
        }],
      })
      .mockResolvedValueOnce({ rows: [{ total: '1' }] });
    resolveRestaurantImageUrl.mockRejectedValue(
      Object.assign(new Error('provider unavailable'), {
        statusCode: 503,
        code: 'PROVIDER_UNAVAILABLE',
      }),
    );

    const result = await listRestaurants();

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
      primaryImageUrl: null,
    });
  });
});
