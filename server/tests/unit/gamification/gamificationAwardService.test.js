import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/services/notificationService.js', () => ({
  NOTIFICATION_TYPES: {
    reviewVerified: 'REVIEW_VERIFIED',
    badgeEarned: 'BADGE_EARNED',
  },
  createNotification: vi.fn().mockResolvedValue({ id: 'notification-id' }),
}));

const { createNotification } = await import('../../../src/services/notificationService.js');
const { awardVerifiedReview } = await import('../../../src/services/gamificationAwardService.js');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const REVIEW_ID = '22222222-2222-4222-8222-222222222222';
const RESTAURANT_ID = '33333333-3333-4333-8333-333333333333';

function createClient({ existingAward = false, existingBadges = [] } = {}) {
  let expPoints = 50;
  const awardedBadges = new Set(existingBadges);

  return {
    query: vi.fn(async (sql, params = []) => {
      const text = String(sql);

      if (/FROM users[\s\S]*FOR UPDATE/i.test(text)) {
        return {
          rowCount: 1,
          rows: [{ exp_points: expPoints, rank_code: 'NEWBIE' }],
        };
      }
      if (/INSERT INTO exp_transactions/i.test(text)) {
        return {
          rowCount: existingAward ? 0 : 1,
          rows: existingAward ? [] : [{ id: 'award' }],
        };
      }
      if (/UPDATE users[\s\S]*exp_points/i.test(text)) {
        expPoints += params[1];
        return { rowCount: 1, rows: [] };
      }
      if (/SELECT exp_points FROM users/i.test(text)) {
        return { rowCount: 1, rows: [{ exp_points: expPoints }] };
      }
      if (/FROM restaurants[\s\S]*FOR UPDATE/i.test(text)) {
        return { rowCount: 1, rows: [{ id: RESTAURANT_ID }] };
      }
      if (/COUNT\(\*\)::int AS count[\s\S]*status = 'VERIFIED'/i.test(text)
          && !/reviews mine/i.test(text)) {
        return { rowCount: 1, rows: [{ count: 10 }] };
      }
      if (/SELECT status[\s\S]*LIMIT 10/i.test(text)) {
        return {
          rowCount: 10,
          rows: Array.from({ length: 10 }, () => ({ status: 'VERIFIED' })),
        };
      }
      if (/FROM reviews mine/i.test(text)) {
        return { rowCount: 1, rows: [{ count: 5 }] };
      }
      if (/INSERT INTO user_badges/i.test(text)) {
        const code = params[1];
        if (awardedBadges.has(code)) return { rowCount: 0, rows: [] };
        awardedBadges.add(code);
        return {
          rowCount: 1,
          rows: [{
            code,
            label: code === 'RECEIPT_MASTER'
                ? 'Bậc thầy hóa đơn'
                : 'Người khám phá',
            awardedAt: new Date('2026-07-14T10:00:00.000Z'),
          }],
        };
      }
      if (/JOIN users/i.test(text) && /trust_weight_bucket/i.test(text)) {
        return {
          rowCount: 1,
          rows: [{
            averageRating: '5.00',
            trustWeightBucket: 'HIGH',
            rankCode: 'APPRENTICE',
          }],
        };
      }
      if (/UPDATE restaurants/i.test(text)) {
        return { rowCount: 1, rows: [{ id: RESTAURANT_ID }] };
      }
      return { rowCount: 1, rows: [] };
    }),
  };
}

describe('awardVerifiedReview', () => {
  beforeEach(() => {
    createNotification.mockClear();
  });

  it('awards verified EXP, rank, qualifying badges, and notifications', async () => {
    const client = createClient();

    const result = await awardVerifiedReview({
      client,
      userId: USER_ID,
      reviewId: REVIEW_ID,
      restaurantId: RESTAURANT_ID,
      notificationsEnabled: true,
    });

    expect(result.expAwarded).toBe(50);
    expect(result.expPoints).toBe(100);
    expect(result.level.code).toBe('APPRENTICE');
    expect(result.newlyAwardedBadges.map((badge) => badge.code)).toEqual([
      'RECEIPT_MASTER',
      'EXPLORER',
    ]);
    expect(createNotification).toHaveBeenCalledTimes(3);
    expect(createNotification).toHaveBeenCalledWith(client, expect.objectContaining({
      recipientUserId: USER_ID,
      type: 'REVIEW_VERIFIED',
      payload: { reviewId: REVIEW_ID },
    }));
    const streakQuery = client.query.mock.calls.find(([sql]) => (
      /SELECT status[\s\S]*LIMIT 10/i.test(String(sql))
    ))?.[0];
    expect(streakQuery).toContain(
      "status IN ('VERIFIED', 'REFERENCE_ONLY', 'REJECTED')",
    );
    expect(streakQuery).not.toContain('HIDDEN');
  });

  it('does not duplicate EXP or badge awards when processing is retried', async () => {
    const client = createClient({
      existingAward: true,
      existingBadges: ['RECEIPT_MASTER', 'EXPLORER'],
    });

    const result = await awardVerifiedReview({
      client,
      userId: USER_ID,
      reviewId: REVIEW_ID,
      restaurantId: RESTAURANT_ID,
      notificationsEnabled: false,
    });

    expect(result.expAwarded).toBe(0);
    expect(result.newlyAwardedBadges).toEqual([]);
    expect(createNotification).not.toHaveBeenCalled();
    expect(client.query.mock.calls.filter(([sql]) => /INSERT INTO exp_transactions/i.test(sql))).toHaveLength(1);
  });
});
