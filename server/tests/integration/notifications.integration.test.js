import { afterAll, afterEach, describe, expect, it } from 'vitest';

process.env.TRUSTBITE_TRUSTED_AUTH_HEADERS = 'true';

const { createUser } = await import('../helpers/factories/index.js');
const { closeDbPool, deleteByIds, query } = await import('../helpers/db.js');
const { requestApp } = await import('../helpers/http.js');

const created = { users: [], notifications: [] };
const authHeaders = (userId) => ({ 'x-trustbite-user-id': userId });

async function createNotification(userId, {
  type = 'REVIEW_VERIFIED',
  title = 'Review verified',
  payload = { reviewId: '11111111-1111-4111-8111-111111111111' },
  read = false,
  createdAt = new Date(),
} = {}) {
  const result = await query(
    `INSERT INTO notifications (
       recipient_user_id, type, title, body, payload, read_at, created_at
     )
     VALUES ($1, $2, $3, 'Body', $4::jsonb, $5, $6)
     RETURNING id`,
    [
      userId,
      type,
      title,
      JSON.stringify(payload),
      read ? createdAt : null,
      createdAt,
    ],
  );
  created.notifications.push(result.rows[0].id);
  return result.rows[0].id;
}

describe('notification API', () => {
  afterEach(async () => {
    await deleteByIds('notifications', 'id', created.notifications);
    await deleteByIds('users', 'id', created.users);
    created.users = [];
    created.notifications = [];
  });

  afterAll(async () => {
    await closeDbPool();
  });

  it('requires authentication', async () => {
    const response = await requestApp().get('/api/v1/notifications').expect(401);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });

  it('lists only the authenticated recipient newest first with unread count', async () => {
    const owner = await createUser({ displayName: 'Notification Owner' });
    const other = await createUser({ displayName: 'Other Recipient' });
    created.users.push(owner.id, other.id);

    await createNotification(owner.id, {
      title: 'Older',
      read: true,
      createdAt: new Date('2026-07-14T09:00:00.000Z'),
    });
    await createNotification(owner.id, {
      type: 'BADGE_EARNED',
      title: 'Newest',
      payload: { badgeCode: 'EXPLORER' },
      createdAt: new Date('2026-07-14T10:00:00.000Z'),
    });
    await createNotification(other.id, { title: 'Foreign' });

    const response = await requestApp()
      .get('/api/v1/notifications?page=1&pageSize=10')
      .set(authHeaders(owner.id))
      .expect(200);

    expect(response.body).toMatchObject({
      page: 1,
      pageSize: 10,
      total: 2,
      unreadCount: 1,
    });
    expect(response.body.items.map((item) => item.title)).toEqual([
      'Newest',
      'Older',
    ]);
    expect(JSON.stringify(response.body)).not.toContain('Foreign');

    const summary = await requestApp()
      .get('/api/v1/notifications/summary')
      .set(authHeaders(owner.id))
      .expect(200);
    expect(summary.body).toEqual({ unreadCount: 1 });
  });

  it('marks an owned notification read idempotently', async () => {
    const owner = await createUser({ displayName: 'Read Owner' });
    created.users.push(owner.id);
    const notificationId = await createNotification(owner.id);

    const first = await requestApp()
      .patch(`/api/v1/notifications/${notificationId}/read`)
      .set(authHeaders(owner.id))
      .send({})
      .expect(200);
    const second = await requestApp()
      .patch(`/api/v1/notifications/${notificationId}/read`)
      .set(authHeaders(owner.id))
      .send({})
      .expect(200);

    expect(first.body.readAt).toBeTruthy();
    expect(second.body.readAt).toBe(first.body.readAt);
  });

  it('does not reveal a notification owned by another user', async () => {
    const owner = await createUser({ displayName: 'Owner' });
    const other = await createUser({ displayName: 'Other' });
    created.users.push(owner.id, other.id);
    const notificationId = await createNotification(owner.id);

    const response = await requestApp()
      .patch(`/api/v1/notifications/${notificationId}/read`)
      .set(authHeaders(other.id))
      .send({})
      .expect(404);

    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
