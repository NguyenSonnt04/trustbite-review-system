import '../helpers/env.js';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

const { createUser, createRestaurant, createReview, createReceiptVerification } = await import('../helpers/factories/index.js');
const { closeDbPool, query } = await import('../helpers/db.js');
const { getRetentionRules } = await import('../../src/config/retentionRules.js');
const {
  purgeExpiredOtpVerifications,
  anonymizeStaleReceiptSignals,
  purgeExpiredNotifications,
} = await import('../../src/services/dataRetentionService.js');

const RULES = getRetentionRules();
const NOW = new Date();

const otpIds = new Set();
const notificationIds = new Set();
const userIds = new Set();
const restaurantIds = new Set();
const reviewIds = new Set();

async function insertOtp(phone, ageDays) {
  const result = await query(
    `INSERT INTO otp_verifications (phone_number, otp_hash, purpose, expires_at, created_at)
     VALUES ($1, $2, 'LOGIN', now(), now() - ($3 || ' days')::interval)
     RETURNING id`,
    [phone, 'hash', String(ageDays)],
  );
  otpIds.add(result.rows[0].id);
  return result.rows[0].id;
}

async function insertNotification(userId, ageDays) {
  const result = await query(
    `INSERT INTO notifications (recipient_user_id, type, title, created_at)
     VALUES ($1, 'TEST', 'Test notification', now() - ($2 || ' days')::interval)
     RETURNING id`,
    [userId, String(ageDays)],
  );
  notificationIds.add(result.rows[0].id);
  return result.rows[0].id;
}

beforeAll(async () => {
  await query(
    `INSERT INTO otp_purposes (code, label, ttl_seconds, max_attempts)
     VALUES ('LOGIN', 'Login', 300, 5)
     ON CONFLICT (code) DO NOTHING`,
  );
});

describe('data retention jobs', () => {
  afterEach(async () => {
    for (const id of otpIds) await query('DELETE FROM otp_verifications WHERE id = $1', [id]);
    for (const id of notificationIds) await query('DELETE FROM notifications WHERE id = $1', [id]);
    for (const id of reviewIds) await query('DELETE FROM reviews WHERE id = $1', [id]);
    for (const id of restaurantIds) await query('DELETE FROM restaurants WHERE id = $1', [id]);
    for (const id of userIds) await query('DELETE FROM users WHERE id = $1', [id]);
    otpIds.clear();
    notificationIds.clear();
    reviewIds.clear();
    restaurantIds.clear();
    userIds.clear();
  });

  afterAll(async () => {
    await closeDbPool();
  });

  it('deletes OTP rows past the retention window and keeps recent ones', async () => {
    const staleId = await insertOtp('+84900000001', RULES.otpRetentionDays + 5);
    const freshId = await insertOtp('+84900000002', 1);

    const deleted = await purgeExpiredOtpVerifications(NOW, RULES);
    expect(deleted).toBeGreaterThanOrEqual(1);

    const stale = await query('SELECT id FROM otp_verifications WHERE id = $1', [staleId]);
    const fresh = await query('SELECT id FROM otp_verifications WHERE id = $1', [freshId]);
    expect(stale.rowCount).toBe(0);
    expect(fresh.rowCount).toBe(1);
  });

  it('deletes notifications past the retention window and keeps recent ones', async () => {
    const user = await createUser({ displayName: 'Retention User' });
    userIds.add(user.id);
    const staleId = await insertNotification(user.id, RULES.notificationRetentionDays + 10);
    const freshId = await insertNotification(user.id, 5);

    const deleted = await purgeExpiredNotifications(NOW, RULES);
    expect(deleted).toBeGreaterThanOrEqual(1);

    const stale = await query('SELECT id FROM notifications WHERE id = $1', [staleId]);
    const fresh = await query('SELECT id FROM notifications WHERE id = $1', [freshId]);
    expect(stale.rowCount).toBe(0);
    expect(fresh.rowCount).toBe(1);
  });

  it('anonymizes IP/GPS on stale receipts, keeps distance and recent receipts', async () => {
    const author = await createUser({ displayName: 'Receipt Author' });
    userIds.add(author.id);
    const restaurant = await createRestaurant();
    restaurantIds.add(restaurant.id);
    const review = await createReview({ userId: author.id, restaurantId: restaurant.id });
    reviewIds.add(review.id);

    const staleReceipt = await createReceiptVerification({ reviewId: review.id, userId: author.id, restaurantId: restaurant.id });
    const freshReceipt = await createReceiptVerification({ reviewId: review.id, userId: author.id, restaurantId: restaurant.id, fileHashSha256: 'a'.repeat(64) });

    const setSignals = async (id, ageDays) => query(
      `UPDATE receipt_verifications
       SET request_ip = '203.0.113.5', gps_latitude = 10.5, gps_longitude = 106.5,
           gps_accuracy_meters = 12.0, gps_distance_meters = 50.0,
           created_at = now() - ($2 || ' days')::interval
       WHERE id = $1`,
      [id, String(ageDays)],
    );
    await setSignals(staleReceipt.id, RULES.receiptSignalRetentionDays + 10);
    await setSignals(freshReceipt.id, 1);

    const anonymized = await anonymizeStaleReceiptSignals(NOW, RULES);
    expect(anonymized).toBeGreaterThanOrEqual(1);

    const stale = await query(
      'SELECT request_ip, gps_latitude, gps_longitude, gps_accuracy_meters, gps_distance_meters FROM receipt_verifications WHERE id = $1',
      [staleReceipt.id],
    );
    expect(stale.rows[0].request_ip).toBeNull();
    expect(stale.rows[0].gps_latitude).toBeNull();
    expect(stale.rows[0].gps_longitude).toBeNull();
    expect(stale.rows[0].gps_accuracy_meters).toBeNull();
    // derived, non-PII distance is retained for audit
    expect(Number(stale.rows[0].gps_distance_meters)).toBe(50);

    const fresh = await query(
      'SELECT request_ip, gps_latitude FROM receipt_verifications WHERE id = $1',
      [freshReceipt.id],
    );
    expect(fresh.rows[0].request_ip).not.toBeNull();
    expect(fresh.rows[0].gps_latitude).not.toBeNull();
  });
});
