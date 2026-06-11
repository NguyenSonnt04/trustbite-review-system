import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/config/db.js', () => ({
  pool: {
    query: vi.fn(),
  },
}));

const { pool } = await import('../../../src/config/db.js');
const { listPublicReviewsByRestaurant } = await import('../../../src/services/reviewService.js');

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';

function mockReviewRow(overrides = {}) {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    userId: '33333333-3333-4333-8333-333333333333',
    restaurantId: RESTAURANT_ID,
    branchId: null,
    foodRating: 5,
    priceRating: 4,
    serviceRating: 5,
    ambienceRating: 4,
    averageRating: '4.50',
    comment: 'Reliable review',
    status: 'VERIFIED',
    verificationStatus: 'VERIFIED',
    trustLabel: 'TRUSTED',
    publicVisibility: 'PUBLIC',
    trustWeightBucket: 'FULL',
    visitedAt: null,
    createdAt: new Date('2026-06-11T00:00:00.000Z'),
    updatedAt: new Date('2026-06-11T00:00:00.000Z'),
    ...overrides,
  };
}

function mockQueryResults(rows = [mockReviewRow()], total = '1') {
  pool.query
    .mockResolvedValueOnce({ rows })
    .mockResolvedValueOnce({ rows: [{ total }] });
}

describe('listPublicReviewsByRestaurant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters ALL public reviews to verified and reference-only statuses', async () => {
    mockQueryResults();

    await listPublicReviewsByRestaurant(RESTAURANT_ID, { status: 'ALL', page: 1, pageSize: 20 });

    const dataSql = pool.query.mock.calls[0][0];
    const countSql = pool.query.mock.calls[1][0];

    expect(dataSql).toContain("r.status IN ('VERIFIED', 'REFERENCE_ONLY')");
    expect(countSql).toContain("r.status IN ('VERIFIED', 'REFERENCE_ONLY')");
    expect(dataSql).toContain("r.public_visibility = 'PUBLIC'");
    expect(countSql).toContain("r.public_visibility = 'PUBLIC'");
  });

  it('filters VERIFIED public reviews distinctly', async () => {
    mockQueryResults([mockReviewRow({ status: 'VERIFIED' })]);

    await listPublicReviewsByRestaurant(RESTAURANT_ID, { status: 'VERIFIED' });

    const dataSql = pool.query.mock.calls[0][0];
    expect(dataSql).toContain("r.status = 'VERIFIED'");
    expect(dataSql).toContain("r.public_visibility = 'PUBLIC'");
  });

  it('filters REFERENCE_ONLY public reviews distinctly', async () => {
    mockQueryResults([mockReviewRow({ status: 'REFERENCE_ONLY' })]);

    await listPublicReviewsByRestaurant(RESTAURANT_ID, { status: 'REFERENCE_ONLY' });

    const dataSql = pool.query.mock.calls[0][0];
    expect(dataSql).toContain("r.status = 'REFERENCE_ONLY'");
    expect(dataSql).toContain("r.public_visibility = 'PUBLIC'");
  });

  it('omits userId from public response items', async () => {
    mockQueryResults();

    const result = await listPublicReviewsByRestaurant(RESTAURANT_ID);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).not.toHaveProperty('userId');
    expect(result.items[0]).toMatchObject({
      id: '22222222-2222-4222-8222-222222222222',
      restaurantId: RESTAURANT_ID,
      averageRating: 4.5,
      status: 'VERIFIED',
    });
  });

  it('uses default pagination and returns numeric totals', async () => {
    mockQueryResults([], '0');

    const result = await listPublicReviewsByRestaurant(RESTAURANT_ID);

    expect(pool.query.mock.calls[0][1]).toEqual([RESTAURANT_ID, 20, 0]);
    expect(pool.query.mock.calls[1][1]).toEqual([RESTAURANT_ID]);
    expect(result).toEqual({ items: [], page: 1, pageSize: 20, total: 0 });
  });

  it('caps pageSize at 100 and computes offset from safe pagination', async () => {
    mockQueryResults([], '0');

    const result = await listPublicReviewsByRestaurant(RESTAURANT_ID, { page: 3, pageSize: 1000 });

    expect(pool.query.mock.calls[0][1]).toEqual([RESTAURANT_ID, 100, 200]);
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(100);
  });
});
