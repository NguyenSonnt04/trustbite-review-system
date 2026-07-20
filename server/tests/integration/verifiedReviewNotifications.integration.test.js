import { afterAll, afterEach, describe, expect, it } from 'vitest';

const {
  createReceiptVerification,
  createRestaurant,
  createReview,
  createUser,
} = await import('../helpers/factories/index.js');
const { closeDbPool, deleteByIds, query } = await import('../helpers/db.js');
const { verifyReceipt } = await import('../../src/services/receiptVerificationService.js');

const created = { users: [], restaurants: [], reviews: [], receipts: [] };

describe('verified review notification transaction', () => {
  afterEach(async () => {
    if (created.receipts.length > 0) {
      await query(
        `DELETE FROM audit_logs
         WHERE entity_type = 'RECEIPT_VERIFICATION'
           AND entity_id = ANY($1::uuid[])`,
        [created.receipts],
      );
    }
    await deleteByIds('receipt_verifications', 'id', created.receipts);
    await deleteByIds('reviews', 'id', created.reviews);
    await deleteByIds('restaurants', 'id', created.restaurants);
    await deleteByIds('users', 'id', created.users);
    created.users = [];
    created.restaurants = [];
    created.reviews = [];
    created.receipts = [];
  });

  afterAll(async () => {
    await closeDbPool();
  });

  it('atomically creates exactly-once EXP and in-app notification side effects', async () => {
    const user = await createUser({ displayName: 'Verified Notification User' });
    const restaurant = await createRestaurant({
      name: 'Notification Test Restaurant',
      latitude: 10.7769,
      longitude: 106.7009,
    });
    const review = await createReview({
      userId: user.id,
      restaurantId: restaurant.id,
      status: 'SUBMITTED',
      verificationStatus: 'PROCESSING',
      trustLabel: 'PROCESSING',
      publicVisibility: 'PRIVATE_UNTIL_DECISION',
      trustWeightBucket: 'NONE',
    });
    const receipt = await createReceiptVerification({
      reviewId: review.id,
      userId: user.id,
      restaurantId: restaurant.id,
      status: 'OCR_SUCCESS',
    });
    created.users.push(user.id);
    created.restaurants.push(restaurant.id);
    created.reviews.push(review.id);
    created.receipts.push(receipt.id);

    const now = new Date('2026-07-14T10:00:00.000Z');
    await query(
      `UPDATE receipt_verifications
       SET ocr_restaurant_name = $2,
           ocr_receipt_time = $3,
           ocr_invoice_no = 'NOTIF-001',
           ocr_total_amount = 120000,
           gps_latitude = $4,
           gps_longitude = $5,
           gps_accuracy_meters = 10,
           created_at = $3
       WHERE id = $1`,
      [
        receipt.id,
        restaurant.name,
        new Date('2026-07-14T09:00:00.000Z'),
        restaurant.latitude,
        restaurant.longitude,
      ],
    );

    const first = await verifyReceipt(receipt.id, {
      now,
      notificationsEnabled: true,
    });
    const second = await verifyReceipt(receipt.id, {
      now,
      notificationsEnabled: true,
    });

    expect(first.decision).toBe('VERIFIED');
    expect(second.decision).toBe('VERIFIED');

    const [userResult, expResult, notificationResult] = await Promise.all([
      query('SELECT exp_points FROM users WHERE id = $1', [user.id]),
      query(
        `SELECT delta
         FROM exp_transactions
         WHERE user_id = $1
           AND reason = 'REVIEW_VERIFIED'
           AND entity_id = $2`,
        [user.id, review.id],
      ),
      query(
        `SELECT type, payload
         FROM notifications
         WHERE recipient_user_id = $1
           AND type = 'REVIEW_VERIFIED'
           AND payload ->> 'reviewId' = $2`,
        [user.id, review.id],
      ),
    ]);

    expect(userResult.rows[0].exp_points).toBe(50);
    expect(expResult.rows).toEqual([{ delta: 50 }]);
    expect(notificationResult.rows).toEqual([{
      type: 'REVIEW_VERIFIED',
      payload: { reviewId: review.id },
    }]);
  });
});
