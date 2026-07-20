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
const {
  listActiveRestaurantBranches,
  listRestaurants,
} = await import('../../../src/services/restaurantService.js');

function restaurantRow(overrides = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Signing fallback restaurant',
    slug: 'signing-fallback-restaurant',
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
    primary_image_url:
      's3://trustbite-restaurant-images/restaurant-images/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.jpg',
    created_at: new Date('2026-07-15T00:00:00.000Z'),
    updated_at: new Date('2026-07-15T00:00:00.000Z'),
    ...overrides,
  };
}

describe('listRestaurants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps public restaurant data available when image delivery fails', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [restaurantRow()] })
      .mockResolvedValueOnce({ rows: [{ total: '1' }] });
    resolveRestaurantImageUrl.mockRejectedValue(
      Object.assign(new Error('signing unavailable'), {
        statusCode: 503,
        code: 'PROVIDER_UNAVAILABLE',
      }),
    );

    await expect(listRestaurants()).resolves.toMatchObject({
      items: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          primaryImageUrl: null,
        },
      ],
      total: 1,
    });
  });
});

describe('listActiveRestaurantBranches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns active branches from the restaurant domain service', async () => {
    pool.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'restaurant-id' }] })
      .mockResolvedValueOnce({
        rows: [{
          id: '22222222-2222-4222-8222-222222222222',
          parent_restaurant_id: '11111111-1111-4111-8111-111111111111',
          name: 'District 1',
          address: '123 Test Street',
          latitude: '10.123',
          longitude: '106.456',
        }],
      });

    await expect(listActiveRestaurantBranches(
      '11111111-1111-4111-8111-111111111111',
    )).resolves.toEqual({
      items: [{
        id: '22222222-2222-4222-8222-222222222222',
        restaurantId: '11111111-1111-4111-8111-111111111111',
        name: 'District 1',
        address: '123 Test Street',
        area: null,
        latitude: 10.123,
        longitude: 106.456,
      }],
    });
  });
});
