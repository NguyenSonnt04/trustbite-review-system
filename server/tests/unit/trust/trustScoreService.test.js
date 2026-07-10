import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/config/db.js', () => {
  const client = { query: vi.fn(), release: vi.fn() };
  return {
    pool: { connect: vi.fn(async () => client) },
    __client: client,
  };
});

const db = await import('../../../src/config/db.js');
const client = db.__client;
const { recomputeRestaurantTrustScore, NotFoundError, ValidationError } = await import(
  '../../../src/services/trustScoreService.js'
);

const RESTAURANT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function mockReviewsThenUpdate(reviewRows, { updateRowCount = 1 } = {}) {
  client.query.mockReset();
  client.release.mockReset();
  db.pool.connect.mockClear();

  client.query.mockImplementation(async (sql) => {
    const text = String(sql);
    if (/^\s*BEGIN/i.test(text) || /^\s*COMMIT/i.test(text) || /^\s*ROLLBACK/i.test(text)) return {};
    if (/FROM\s+reviews/i.test(text)) return { rows: reviewRows };
    if (/UPDATE\s+restaurants/i.test(text)) {
      return { rows: updateRowCount ? [{ id: RESTAURANT_ID }] : [], rowCount: updateRowCount };
    }
    return { rows: [] };
  });
}

function updateCall() {
  return client.query.mock.calls.find((c) => /UPDATE\s+restaurants/i.test(String(c[0])));
}

describe('recomputeRestaurantTrustScore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects an invalid restaurantId before opening a transaction', async () => {
    await expect(recomputeRestaurantTrustScore('not-a-uuid')).rejects.toBeInstanceOf(ValidationError);
    expect(db.pool.connect).not.toHaveBeenCalled();
  });

  it('opens its own transaction, persists the computed score/counts, and commits', async () => {
    mockReviewsThenUpdate([
      { averageRating: '5.00', trustWeightBucket: 'HIGH', rankCode: 'FOODIE' },
      { averageRating: '1.00', trustWeightBucket: 'LOW', rankCode: 'NEWBIE' },
    ]);

    const result = await recomputeRestaurantTrustScore(RESTAURANT_ID);

    // (5*1.0 + 1*0.1) / 1.1 = 4.636… → 4.64
    expect(result).toEqual({ trustScore: 4.64, verifiedReviewCount: 1, referenceReviewCount: 1 });

    const upd = updateCall();
    expect(upd[1]).toEqual([RESTAURANT_ID, 4.64, 1, 1]);

    const texts = client.query.mock.calls.map((c) => String(c[0]));
    expect(texts.some((t) => /^\s*BEGIN/i.test(t))).toBe(true);
    expect(texts.some((t) => /^\s*COMMIT/i.test(t))).toBe(true);
    expect(client.release).toHaveBeenCalled();
  });

  it('persists the neutral default when a restaurant has no qualifying reviews', async () => {
    mockReviewsThenUpdate([]);

    const result = await recomputeRestaurantTrustScore(RESTAURANT_ID);

    expect(result).toEqual({ trustScore: 5.0, verifiedReviewCount: 0, referenceReviewCount: 0 });
    expect(updateCall()[1]).toEqual([RESTAURANT_ID, 5.0, 0, 0]);
  });

  it('joins a caller-provided client without opening or releasing its own transaction', async () => {
    const outer = { query: vi.fn(), release: vi.fn() };
    outer.query.mockImplementation(async (sql) => {
      const text = String(sql);
      if (/FROM\s+reviews/i.test(text)) return { rows: [{ averageRating: '4.00', trustWeightBucket: 'HIGH', rankCode: 'NEWBIE' }] };
      if (/UPDATE\s+restaurants/i.test(text)) return { rows: [{ id: RESTAURANT_ID }], rowCount: 1 };
      return { rows: [] };
    });

    const result = await recomputeRestaurantTrustScore(RESTAURANT_ID, { client: outer });

    expect(result.trustScore).toBe(4.0);
    // Must not manage transaction lifecycle on a borrowed client.
    const outerTexts = outer.query.mock.calls.map((c) => String(c[0]));
    expect(outerTexts.some((t) => /^\s*BEGIN/i.test(t))).toBe(false);
    expect(outerTexts.some((t) => /^\s*COMMIT/i.test(t))).toBe(false);
    expect(outer.release).not.toHaveBeenCalled();
    // Pool must not be used when a client is supplied.
    expect(db.pool.connect).not.toHaveBeenCalled();
  });

  it('throws NotFoundError and rolls back when the restaurant does not exist', async () => {
    mockReviewsThenUpdate([], { updateRowCount: 0 });

    await expect(recomputeRestaurantTrustScore(RESTAURANT_ID)).rejects.toBeInstanceOf(NotFoundError);

    const texts = client.query.mock.calls.map((c) => String(c[0]));
    expect(texts.some((t) => /^\s*ROLLBACK/i.test(t))).toBe(true);
    expect(client.release).toHaveBeenCalled();
  });

  it('rolls back and releases when a query throws', async () => {
    client.query.mockReset();
    client.release.mockReset();
    db.pool.connect.mockClear();
    client.query.mockImplementation(async (sql) => {
      const text = String(sql);
      if (/^\s*BEGIN/i.test(text)) return {};
      if (/FROM\s+reviews/i.test(text)) throw new Error('db read failed');
      return {};
    });

    await expect(recomputeRestaurantTrustScore(RESTAURANT_ID)).rejects.toThrow('db read failed');
    const texts = client.query.mock.calls.map((c) => String(c[0]));
    expect(texts.some((t) => /^\s*ROLLBACK/i.test(t))).toBe(true);
    expect(client.release).toHaveBeenCalled();
  });
});
