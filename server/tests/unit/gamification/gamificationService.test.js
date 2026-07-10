import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/config/db.js', () => ({
  pool: { query: vi.fn() },
}));

const { pool } = await import('../../../src/config/db.js');
const { getUserGamification } = await import('../../../src/services/gamificationService.js');

const USER_ID = '11111111-1111-4111-8111-111111111111';

function mockQueries({ user, verifiedCount = 0, badges = [] }) {
  pool.query.mockReset();
  pool.query.mockImplementation(async (sql) => {
    const text = String(sql);
    if (/FROM\s+users/i.test(text)) {
      return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
    }
    if (/FROM\s+reviews/i.test(text)) {
      return { rows: [{ count: verifiedCount }], rowCount: 1 };
    }
    if (/FROM\s+user_badges/i.test(text)) {
      return { rows: badges, rowCount: badges.length };
    }
    return { rows: [] };
  });
}

const activeUser = (overrides = {}) => ({
  id: USER_ID,
  status: 'ACTIVE',
  exp_points: 0,
  rank_code: 'NEWBIE',
  ...overrides,
});

describe('getUserGamification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns points, derived level, next-level progress, and badges', async () => {
    mockQueries({
      user: activeUser({ exp_points: 120 }),
      verifiedCount: 2,
      badges: [
        { code: 'RECEIPT_MASTER', label: 'Receipt Master', icon_url: 'i.png', category: 'ACHIEVEMENT', awarded_at: '2026-07-01T00:00:00Z' },
      ],
    });

    const result = await getUserGamification(USER_ID);

    expect(result.expPoints).toBe(120);
    expect(result.verifiedReviewCount).toBe(2);
    expect(result.level.code).toBe('APPRENTICE'); // 120 exp + 2 verified
    expect(result.nextLevel).toMatchObject({ code: 'FOODIE', expToNext: 380, verifiedReviewsToNext: 8 });
    expect(result.badges).toEqual([
      { code: 'RECEIPT_MASTER', label: 'Receipt Master', iconUrl: 'i.png', category: 'ACHIEVEMENT', awardedAt: '2026-07-01T00:00:00Z' },
    ]);
  });

  it('defaults a brand-new user to NEWBIE with no badges', async () => {
    mockQueries({ user: activeUser(), verifiedCount: 0, badges: [] });

    const result = await getUserGamification(USER_ID);

    expect(result).toMatchObject({
      expPoints: 0,
      verifiedReviewCount: 0,
      badges: [],
    });
    expect(result.level.code).toBe('NEWBIE');
    expect(result.nextLevel.code).toBe('APPRENTICE');
  });

  it('throws 404 when the user does not exist', async () => {
    mockQueries({ user: null });
    await expect(getUserGamification(USER_ID)).rejects.toMatchObject({ statusCode: 404, code: 'USER_NOT_FOUND' });
  });

  it('throws 403 for a suspended account', async () => {
    mockQueries({ user: activeUser({ status: 'SUSPENDED' }) });
    await expect(getUserGamification(USER_ID)).rejects.toMatchObject({ statusCode: 403, code: 'ACCOUNT_SUSPENDED' });
  });

  it('throws 403 for a deleted account', async () => {
    mockQueries({ user: activeUser({ status: 'DELETED' }) });
    await expect(getUserGamification(USER_ID)).rejects.toMatchObject({ statusCode: 403, code: 'ACCOUNT_DELETED' });
  });
});
