import { pool } from '../config/db.js';
import { createHttpError } from '../utils/httpErrors.js';

export const NOTIFICATION_TYPES = Object.freeze({
  reviewVerified: 'REVIEW_VERIFIED',
  badgeEarned: 'BADGE_EARNED',
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BADGE_CODE_REGEX = /^[A-Z][A-Z0-9_]{1,79}$/;

const NOTIFICATION_PROJECTION = `
  id,
  type,
  title,
  body,
  payload,
  read_at AS "readAt",
  created_at AS "createdAt"
`;

function publicPayload(type, payload) {
  if (type === NOTIFICATION_TYPES.reviewVerified
      && typeof payload?.reviewId === 'string') {
    return { reviewId: payload.reviewId };
  }
  if (type === NOTIFICATION_TYPES.badgeEarned
      && typeof payload?.badgeCode === 'string') {
    return { badgeCode: payload.badgeCode };
  }
  return {};
}

function toPublicNotification(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    payload: publicPayload(row.type, row.payload),
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
}

function validationError(field, message) {
  return createHttpError(422, 'VALIDATION_ERROR', message, [
    { field, code: 'INVALID_VALUE', message },
  ]);
}

function parsePositiveInteger(value, field, fallback, maximum) {
  if (value === undefined || value === null || value === '') return fallback;
  if (!/^\d+$/.test(String(value))) {
    throw validationError(field, `${field} must be a positive integer.`);
  }
  const parsed = Number(value);
  if (parsed < 1 || parsed > maximum) {
    throw validationError(field, `${field} must be between 1 and ${maximum}.`);
  }
  return parsed;
}

function assertUuid(value, field) {
  if (typeof value !== 'string' || !UUID_REGEX.test(value)) {
    throw validationError(field, `${field} must be a valid UUID.`);
  }
}

function notificationContent(type, payload) {
  if (type === NOTIFICATION_TYPES.reviewVerified) {
    assertUuid(payload?.reviewId, 'payload.reviewId');
    return {
      title: 'Review của bạn đã được xác minh',
      body: 'Review đã vượt qua kiểm tra độ tin cậy.',
      payload: { reviewId: payload.reviewId },
    };
  }

  if (type === NOTIFICATION_TYPES.badgeEarned) {
    if (typeof payload?.badgeCode !== 'string' || !BADGE_CODE_REGEX.test(payload.badgeCode)) {
      throw validationError('payload.badgeCode', 'payload.badgeCode is invalid.');
    }
    const badgeLabel = typeof payload.badgeLabel === 'string' && payload.badgeLabel.trim()
      ? payload.badgeLabel.trim().slice(0, 120)
      : payload.badgeCode;
    return {
      title: 'Bạn vừa nhận huy hiệu mới',
      body: `Huy hiệu ${badgeLabel} đã được thêm vào hồ sơ của bạn.`,
      payload: { badgeCode: payload.badgeCode },
    };
  }

  throw validationError('type', 'Unsupported notification type.');
}

export async function createNotification(client, { recipientUserId, type, payload }) {
  assertUuid(recipientUserId, 'recipientUserId');
  const content = notificationContent(type, payload);

  const result = await client.query(
    `INSERT INTO notifications (recipient_user_id, type, title, body, payload)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT DO NOTHING
     RETURNING ${NOTIFICATION_PROJECTION}`,
    [
      recipientUserId,
      type,
      content.title,
      content.body,
      JSON.stringify(content.payload),
    ],
  );

  return result.rows[0] ?? null;
}

export async function listNotifications({
  userId,
  page = 1,
  pageSize = 20,
}) {
  assertUuid(userId, 'userId');
  const safePage = parsePositiveInteger(page, 'page', 1, Number.MAX_SAFE_INTEGER);
  const safePageSize = parsePositiveInteger(pageSize, 'pageSize', 20, 100);
  const offset = (safePage - 1) * safePageSize;

  const result = await pool.query(
    `WITH counts AS (
       SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE read_at IS NULL)::int AS "unreadCount"
       FROM notifications
       WHERE recipient_user_id = $1
     ),
     page_items AS (
       SELECT ${NOTIFICATION_PROJECTION}
       FROM notifications
       WHERE recipient_user_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT $2 OFFSET $3
     )
     SELECT
       counts.total,
       counts."unreadCount",
       COALESCE(
         jsonb_agg(
           to_jsonb(page_items)
           ORDER BY page_items."createdAt" DESC, page_items.id DESC
         )
           FILTER (WHERE page_items.id IS NOT NULL),
         '[]'::jsonb
       ) AS items
     FROM counts
     LEFT JOIN page_items ON TRUE
     GROUP BY counts.total, counts."unreadCount"`,
    [userId, safePageSize, offset],
  );
  const row = result.rows[0] ?? { items: [], total: 0, unreadCount: 0 };

  return {
    items: row.items.map(toPublicNotification),
    page: safePage,
    pageSize: safePageSize,
    total: row.total ?? 0,
    unreadCount: row.unreadCount ?? 0,
  };
}

export async function getNotificationSummary({ userId }) {
  assertUuid(userId, 'userId');
  const result = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE read_at IS NULL)::int AS "unreadCount"
     FROM notifications
     WHERE recipient_user_id = $1`,
    [userId],
  );
  return { unreadCount: result.rows[0]?.unreadCount ?? 0 };
}

export async function markNotificationRead({ userId, notificationId }) {
  assertUuid(userId, 'userId');
  assertUuid(notificationId, 'notificationId');

  const result = await pool.query(
    `UPDATE notifications
     SET read_at = COALESCE(read_at, NOW())
     WHERE id = $1
       AND recipient_user_id = $2
     RETURNING ${NOTIFICATION_PROJECTION}`,
    [notificationId, userId],
  );

  if (result.rowCount === 0) {
    throw createHttpError(404, 'NOT_FOUND', 'Notification not found.');
  }

  return toPublicNotification(result.rows[0]);
}
