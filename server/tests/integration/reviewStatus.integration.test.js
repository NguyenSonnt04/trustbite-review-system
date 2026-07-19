import '../helpers/env.js';
import { afterAll, afterEach, describe, expect, it } from 'vitest';

process.env.TRUSTBITE_TRUSTED_AUTH_HEADERS = 'true';

const { createUser, createRestaurant, createReview, createReceiptVerification } = await import('../helpers/factories/index.js');
const { closeDbPool, deleteByIds, query } = await import('../helpers/db.js');
const { pool } = await import('../../src/config/db.js');
const { requestApp } = await import('../helpers/http.js');
const { recomputeRestaurantTrustScore } = await import('../../src/services/trustScoreService.js');

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

  it('publishes a receipt-free review as reference only', async () => {
    const owner = await createUser({ displayName: 'Receipt Optional Owner' });
    const restaurant = await createRestaurant();
    const review = await createReview({
      userId: owner.id,
      restaurantId: restaurant.id,
      status: 'SUBMITTED',
      verificationStatus: 'UNVERIFIED',
      trustLabel: 'PENDING_VERIFICATION',
      publicVisibility: 'PRIVATE_UNTIL_DECISION',
      trustWeightBucket: 'NONE',
    });
    created.users.push(owner.id);
    created.restaurants.push(restaurant.id);
    created.reviews.push(review.id);

    const skipped = await requestApp()
      .post(`/api/v1/reviews/${review.id}/skip-verification`)
      .set(authHeaders(owner.id))
      .send({ reason: 'USER_SKIPPED_RECEIPT' })
      .expect(200);

    expect(skipped.body).toMatchObject({
      reviewId: review.id,
      status: 'REFERENCE_ONLY',
      verificationStatus: 'SKIPPED',
      trustLabel: 'REFERENCE_ONLY',
      publicVisibility: 'PUBLIC',
      trustWeightBucket: 'LOW',
    });

    const status = await requestApp()
      .get(`/api/v1/reviews/${review.id}/status`)
      .set(authHeaders(owner.id))
      .expect(200);
    expect(status.body.receipt).toBeNull();

    const publicReviews = await requestApp()
      .get(`/api/v1/restaurants/${restaurant.id}/reviews?status=REFERENCE_ONLY`)
      .expect(200);
    expect(publicReviews.body.items).toEqual([
      expect.objectContaining({
        id: review.id,
        status: 'REFERENCE_ONLY',
        verificationStatus: 'SKIPPED',
        trustLabel: 'REFERENCE_ONLY',
      }),
    ]);

    await query(
      `UPDATE restaurants
       SET verified_review_count = 0,
           reference_review_count = 0
       WHERE id = $1`,
      [restaurant.id],
    );
    await requestApp()
      .post(`/api/v1/reviews/${review.id}/skip-verification`)
      .set(authHeaders(owner.id))
      .send({ reason: 'USER_SKIPPED_RECEIPT' })
      .expect(200);
    const repairedAggregate = await query(
      `SELECT verified_review_count, reference_review_count
       FROM restaurants
       WHERE id = $1`,
      [restaurant.id],
    );
    expect(repairedAggregate.rows[0]).toMatchObject({
      verified_review_count: 0,
      reference_review_count: 1,
    });
  });

  it('serializes concurrent review deletion and reference publication', async () => {
      const firstOwner = await createUser({ displayName: 'Concurrent Reference One' });
      const secondOwner = await createUser({ displayName: 'Concurrent Reference Two' });
      const restaurant = await createRestaurant();
      const firstReview = await createReview({
        userId: firstOwner.id,
        restaurantId: restaurant.id,
        status: 'VERIFIED',
        verificationStatus: 'VERIFIED',
        trustLabel: 'RECEIPT_VERIFIED',
        publicVisibility: 'PUBLIC',
        trustWeightBucket: 'HIGH',
      });
      const secondReview = await createReview({
        userId: secondOwner.id,
        restaurantId: restaurant.id,
        foodRating: 1,
        priceRating: 1,
        serviceRating: 1,
        ambienceRating: 1,
        status: 'SUBMITTED',
        verificationStatus: 'UNVERIFIED',
        trustLabel: 'PENDING_VERIFICATION',
        publicVisibility: 'PRIVATE_UNTIL_DECISION',
        trustWeightBucket: 'NONE',
      });
      created.users.push(firstOwner.id, secondOwner.id);
      created.restaurants.push(restaurant.id);
      created.reviews.push(firstReview.id, secondReview.id);

      const blocker = await pool.connect();
      const firstClient = await pool.connect();
      const secondClient = await pool.connect();

      try {
        await blocker.query('BEGIN');
        await blocker.query('SELECT 1 FROM restaurants WHERE id = $1 FOR UPDATE', [restaurant.id]);
        await Promise.all([
          firstClient.query('BEGIN'),
          secondClient.query('BEGIN'),
        ]);
        await Promise.all([
          firstClient.query(
            `UPDATE reviews
             SET status = 'DELETED',
                 verification_status = 'DELETED',
                 trust_label = 'DELETED',
                 public_visibility = 'PRIVATE',
                 trust_weight_bucket = 'NONE'
             WHERE id = $1`,
            [firstReview.id],
          ),
          secondClient.query(
            `UPDATE reviews
             SET status = 'REFERENCE_ONLY',
                 verification_status = 'SKIPPED',
                 trust_label = 'REFERENCE_ONLY',
                 public_visibility = 'PUBLIC',
                 trust_weight_bucket = 'LOW'
             WHERE id = $1`,
            [secondReview.id],
          ),
        ]);

        const recomputeAndCommit = async (client) => {
          await recomputeRestaurantTrustScore(restaurant.id, { client });
          await client.query('COMMIT');
        };
        const firstRecompute = recomputeAndCommit(firstClient);
        const secondRecompute = recomputeAndCommit(secondClient);
        await blocker.query('COMMIT');
        await Promise.all([firstRecompute, secondRecompute]);

        const aggregate = await query(
          `SELECT trust_score, verified_review_count, reference_review_count
           FROM restaurants
           WHERE id = $1`,
          [restaurant.id],
        );
        expect(Number(aggregate.rows[0].trust_score)).toBe(1);
        expect(aggregate.rows[0]).toMatchObject({
          verified_review_count: 0,
          reference_review_count: 1,
        });
      } finally {
        await Promise.allSettled([
          blocker.query('ROLLBACK'),
          firstClient.query('ROLLBACK'),
          secondClient.query('ROLLBACK'),
        ]);
        blocker.release();
        firstClient.release();
        secondClient.release();
      }
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
    ['reference', 'REFERENCE_ONLY', 'REFERENCE_ONLY', 'REFERENCE_ONLY', 'PUBLIC', 'LOW', 'REFERENCE_ONLY', 'REFERENCE_ONLY'],
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
