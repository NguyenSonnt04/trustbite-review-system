import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/db.js', () => ({
  pool: { query: vi.fn() },
}));

const { pool } = await import('../../src/config/db.js');
const {
  createNotification,
  getNotificationSummary,
  listNotifications,
  markNotificationRead,
  NOTIFICATION_TYPES,
} = await import('../../src/services/notificationService.js');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const NOTIFICATION_ID = '22222222-2222-4222-8222-222222222222';
const REVIEW_ID = '33333333-3333-4333-8333-333333333333';

describe('notificationService', () => {
  beforeEach(() => {
    pool.query.mockReset();
  });

  it('lists only the recipient notifications with bounded pagination', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{
        items: [{
          id: NOTIFICATION_ID,
          type: 'REVIEW_VERIFIED',
          title: 'Verified',
          body: 'Done',
          payload: {
            reviewId: REVIEW_ID,
            token: 'must not leave the API',
          },
          readAt: null,
          createdAt: new Date('2026-07-14T10:00:00.000Z'),
        }],
        total: 1,
        unreadCount: 1,
      }],
    });

    const result = await listNotifications({
      userId: USER_ID,
      page: '2',
      pageSize: '10',
    });

    expect(result).toMatchObject({
      page: 2,
      pageSize: 10,
      total: 1,
      unreadCount: 1,
    });
    expect(pool.query.mock.calls[0][1]).toEqual([USER_ID, 10, 10]);
    expect(pool.query.mock.calls[0][0]).toMatch(/recipient_user_id = \$1/);
    expect(result.items[0].payload).toEqual({ reviewId: REVIEW_ID });
  });

  it('returns a lightweight unread summary', async () => {
    pool.query.mockResolvedValue({ rows: [{ unreadCount: 4 }] });
    await expect(getNotificationSummary({ userId: USER_ID }))
      .resolves
      .toEqual({ unreadCount: 4 });
  });

  it.each([
    [{ page: '0' }, 'page'],
    [{ page: 'abc' }, 'page'],
    [{ pageSize: '101' }, 'pageSize'],
  ])('rejects invalid pagination %#', async (pagination, field) => {
    await expect(listNotifications({
      userId: USER_ID,
      ...pagination,
    })).rejects.toMatchObject({
      statusCode: 422,
      code: 'VALIDATION_ERROR',
      details: [expect.objectContaining({ field })],
    });
  });

  it('marks a recipient-owned notification read idempotently', async () => {
    pool.query.mockResolvedValue({
      rowCount: 1,
      rows: [{
        id: NOTIFICATION_ID,
        readAt: new Date('2026-07-14T10:00:00.000Z'),
      }],
    });

    const result = await markNotificationRead({
      userId: USER_ID,
      notificationId: NOTIFICATION_ID,
    });

    expect(result.id).toBe(NOTIFICATION_ID);
    expect(pool.query.mock.calls[0][0]).toMatch(/COALESCE\(read_at, NOW\(\)\)/);
    expect(pool.query.mock.calls[0][1]).toEqual([NOTIFICATION_ID, USER_ID]);
  });

  it('hides foreign-owned and missing notifications behind not found', async () => {
    pool.query.mockResolvedValue({ rowCount: 0, rows: [] });

    await expect(markNotificationRead({
      userId: USER_ID,
      notificationId: NOTIFICATION_ID,
    })).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });

  it('allowlists review payload fields before persistence', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [{ id: NOTIFICATION_ID }] }),
    };

    await createNotification(client, {
      recipientUserId: USER_ID,
      type: NOTIFICATION_TYPES.reviewVerified,
      payload: {
        reviewId: REVIEW_ID,
        ocrText: 'must not persist',
        token: 'must not persist',
      },
    });

    expect(JSON.parse(client.query.mock.calls[0][1][4])).toEqual({
      reviewId: REVIEW_ID,
    });
  });
});
