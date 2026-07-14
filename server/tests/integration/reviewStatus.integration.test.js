import '../helpers/env.js';
import { afterAll, afterEach, describe, expect, it } from 'vitest';

process.env.TRUSTBITE_TRUSTED_AUTH_HEADERS = 'true';

const { createUser, createRestaurant, createReview, createReceiptVerification } = await import('../helpers/factories/index.js');
const { closeDbPool, deleteByIds, query } = await import('../helpers/db.js');
const { requestApp } = await import('../helpers/http.js');

const authHeaders = (userId) => ({
  'x-trustbite-user-id': userId,
});

const created = { users: [], restaurants: [], reviews: [], receipts: [] };

async function seedReviewStatus({
  ownerId,
  reviewStatus,
  verificationStatus,
  trustLabel,
  publicVisibility,
  trustWeightBucket,
  receiptStatus,
  decision = null,
  decisionReason = null,
}) {
  const restaurant = await createRestaurant();
  const review = await createReview({
    userId: ownerId,
    restaurantId: restaurant.id,
    status: reviewStatus,
    verificationStatus,
    trustLabel,
    publicVisibility,
    trustWeightBucket,
  });
  const receipt = await createReceiptVerification({
    reviewId: review.id,
    userId: ownerId,
    restaurantId: restaurant.id,
    status: receiptStatus,
  });

  await query(
    `UPDATE receipt_verifications
     SET decision = $2,
         decision_reason = $3,
         decided_at = CASE WHEN $2::varchar IS NULL THEN NULL ELSE NOW() END
     WHERE id = $1`,
    [receipt.id, decision, decisionReason],
  );

  created.restaurants.push(restaurant.id);
  created.reviews.push(review.id);
  created.receipts.push(receipt.id);

  return { restaurant, review, receipt };
}

describe('review verification status API', () => {
  afterEach(async () => {
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

  it('returns pending review and receipt state for the owning user without exposing storage fields', async () => {
    const owner = await createUser({ displayName: 'Review Status Owner' });
    created.users.push(owner.id);
    const { review, receipt } = await seedReviewStatus({
      ownerId: owner.id,
      reviewStatus: 'SUBMITTED',
      verificationStatus: 'PROCESSING',
      trustLabel: 'PROCESSING',
      publicVisibility: 'PRIVATE_UNTIL_DECISION',
      trustWeightBucket: 'NONE',
      receiptStatus: 'UPLOADED',
    });

    const response = await requestApp()
      .get(`/api/v1/reviews/${review.id}/status`)
      .set(authHeaders(owner.id))
      .expect(200);

    expect(response.body).toMatchObject({
      reviewId: review.id,
      restaurantId: review.restaurant_id,
      status: 'SUBMITTED',
      verificationStatus: 'PROCESSING',
      trustLabel: 'PROCESSING',
      publicVisibility: 'PRIVATE_UNTIL_DECISION',
      trustWeightBucket: 'NONE',
      receipt: {
        receiptVerificationId: receipt.id,
        status: 'UPLOADED',
        decision: null,
      },
    });
    expect(response.body.receipt).not.toHaveProperty('fileUrl');
    expect(response.body.receipt).not.toHaveProperty('fileHashSha256');
  });

  it.each([
    ['verified', 'VERIFIED', 'VERIFIED', 'TRUSTED', 'PUBLIC', 'HIGH', 'VERIFIED', 'VERIFIED'],
    ['rejected', 'REJECTED', 'REJECTED', 'REJECTED', 'PRIVATE', 'NONE', 'REJECTED', 'REJECTED'],
    ['reference', 'REFERENCE_ONLY', 'REFERENCE_ONLY', 'REFERENCE_ONLY', 'PRIVATE', 'NONE', 'REFERENCE_ONLY', 'REFERENCE_ONLY'],
    ['admin-review', 'PENDING_ADMIN_REVIEW', 'PENDING_ADMIN_REVIEW', 'PENDING_ADMIN_REVIEW', 'PRIVATE', 'NONE', 'PENDING_ADMIN_REVIEW', null],
  ])('returns %s lifecycle state', async (
    _label,
    reviewStatus,
    verificationStatus,
    trustLabel,
    publicVisibility,
    trustWeightBucket,
    receiptStatus,
    decision,
  ) => {
    const owner = await createUser({ displayName: `Review Status ${_label}` });
    created.users.push(owner.id);
    const { review, receipt } = await seedReviewStatus({
      ownerId: owner.id,
      reviewStatus,
      verificationStatus,
      trustLabel,
      publicVisibility,
      trustWeightBucket,
      receiptStatus,
      decision,
      decisionReason: decision ? `${decision} by automated verification` : 'Needs manual review',
    });

    const response = await requestApp()
      .get(`/api/v1/reviews/${review.id}/status`)
      .set(authHeaders(owner.id))
      .expect(200);

    expect(response.body).toMatchObject({
      reviewId: review.id,
      status: reviewStatus,
      verificationStatus,
      trustLabel,
      publicVisibility,
      trustWeightBucket,
      receipt: {
        receiptVerificationId: receipt.id,
        status: receiptStatus,
        decision,
      },
    });
  });

  it('replaces pending-admin provider failure detail with a fixed public reason', async () => {
    const owner = await createUser({ displayName: 'Pending Review Owner' });
    created.users.push(owner.id);
    const { review } = await seedReviewStatus({
      ownerId: owner.id,
      reviewStatus: 'PENDING_ADMIN_REVIEW',
      verificationStatus: 'PENDING_ADMIN_REVIEW',
      trustLabel: 'PENDING_ADMIN_REVIEW',
      publicVisibility: 'PRIVATE',
      trustWeightBucket: 'NONE',
      receiptStatus: 'PENDING_ADMIN_REVIEW',
      decisionReason: 'OCR enqueue failed; pending manual review.',
    });

    const response = await requestApp()
      .get(`/api/v1/reviews/${review.id}/status`)
      .set(authHeaders(owner.id))
      .expect(200);

    expect(response.body.receipt.decisionReason).toBe(
      'Receipt verification requires manual review.',
    );
    expect(JSON.stringify(response.body)).not.toContain('OCR enqueue failed');
  });

  it('returns not found for a review owned by another user', async () => {
    const owner = await createUser({ displayName: 'Review Owner' });
    const otherUser = await createUser({ displayName: 'Other Viewer' });
    created.users.push(owner.id, otherUser.id);
    const { review } = await seedReviewStatus({
      ownerId: owner.id,
      reviewStatus: 'SUBMITTED',
      verificationStatus: 'PROCESSING',
      trustLabel: 'PROCESSING',
      publicVisibility: 'PRIVATE_UNTIL_DECISION',
      trustWeightBucket: 'NONE',
      receiptStatus: 'UPLOADED',
    });

    const response = await requestApp()
      .get(`/api/v1/reviews/${review.id}/status`)
      .set(authHeaders(otherUser.id))
      .expect(404);

    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('returns not found for a missing review id', async () => {
    const owner = await createUser({ displayName: 'Missing Review Viewer' });
    created.users.push(owner.id);

    const response = await requestApp()
      .get('/api/v1/reviews/99999999-9999-4999-8999-999999999999/status')
      .set(authHeaders(owner.id))
      .expect(404);

    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
