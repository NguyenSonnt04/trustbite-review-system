import '../helpers/env.js';
import { afterAll, afterEach, describe, expect, it } from 'vitest';

process.env.TRUSTBITE_TRUSTED_AUTH_HEADERS = 'true';

const {
  createRestaurant,
  createReview,
  createUser,
} = await import('../helpers/factories/index.js');
const { closeDbPool, query } = await import('../helpers/db.js');
const { requestApp } = await import('../helpers/http.js');

const authHeaders = (userId) => ({
  'x-trustbite-user-id': userId,
});

const createdUserIds = new Set();
const createdRestaurantIds = new Set();
const createdReviewIds = new Set();

async function newUser(overrides = {}) {
  const user = await createUser(overrides);
  createdUserIds.add(user.id);
  return user;
}

async function newRestaurant(overrides = {}) {
  const restaurant = await createRestaurant(overrides);
  createdRestaurantIds.add(restaurant.id);
  return restaurant;
}

async function newReview(input) {
  const review = await createReview(input);
  createdReviewIds.add(review.id);
  return review;
}

describe('review-author block API', () => {
  afterEach(async () => {
    for (const userId of createdUserIds) {
      await query(
        'DELETE FROM user_blocks WHERE blocker_user_id = $1 OR blocked_user_id = $1',
        [userId],
      );
    }
    for (const reviewId of createdReviewIds) {
      await query('DELETE FROM reviews WHERE id = $1', [reviewId]);
    }
    for (const restaurantId of createdRestaurantIds) {
      await query('DELETE FROM restaurants WHERE id = $1', [restaurantId]);
    }
    for (const userId of createdUserIds) {
      await query('DELETE FROM users WHERE id = $1', [userId]);
    }
    createdReviewIds.clear();
    createdRestaurantIds.clear();
    createdUserIds.clear();
  });

  afterAll(async () => {
    await closeDbPool();
  });

  it('blocks and unblocks a public review author without exposing the author id', async () => {
    const actor = await newUser({ displayName: 'Context Block Actor' });
    const author = await newUser({ displayName: 'Context Block Author' });
    const restaurant = await newRestaurant({ name: 'Context Block Restaurant' });
    const review = await newReview({
      userId: author.id,
      restaurantId: restaurant.id,
      status: 'REFERENCE_ONLY',
      verificationStatus: 'SKIPPED',
      trustLabel: 'REFERENCE_ONLY',
      trustWeightBucket: 'LOW',
      publicVisibility: 'PUBLIC',
    });

    const block = await requestApp()
      .post(`/api/v1/reviews/${review.id}/block-author`)
      .set(authHeaders(actor.id))
      .send({})
      .expect(201);

    expect(block.body).toEqual({
      success: true,
      blockedAt: expect.any(String),
    });
    expect(block.body).not.toHaveProperty('blockedUserId');
    expect(JSON.stringify(block.body)).not.toContain(author.id);

    const stored = await query(
      `SELECT blocked_user_id, source_review_id, deleted_at
       FROM user_blocks
       WHERE blocker_user_id = $1`,
      [actor.id],
    );
    expect(stored.rows).toEqual([{
      blocked_user_id: author.id,
      source_review_id: review.id,
      deleted_at: null,
    }]);

    await query(
      `UPDATE reviews
       SET public_visibility = 'PRIVATE'
       WHERE id = $1`,
      [review.id],
    );

    const unblock = await requestApp()
      .delete(`/api/v1/reviews/${review.id}/block-author`)
      .set(authHeaders(actor.id))
      .expect(200);
    expect(unblock.body).toEqual({ success: true });
    expect(JSON.stringify(unblock.body)).not.toContain(author.id);

    const afterUnblock = await query(
      `SELECT deleted_at
       FROM user_blocks
       WHERE blocker_user_id = $1 AND blocked_user_id = $2`,
      [actor.id, author.id],
    );
    expect(afterUnblock.rows[0].deleted_at).not.toBeNull();
  });

  it('unblocks a review author when the active block was created directly', async () => {
    const actor = await newUser({ displayName: 'Direct Block Actor' });
    const author = await newUser({ displayName: 'Direct Block Author' });
    const restaurant = await newRestaurant({ name: 'Direct Block Restaurant' });
    const review = await newReview({
      userId: author.id,
      restaurantId: restaurant.id,
      status: 'VERIFIED',
      publicVisibility: 'PUBLIC',
    });

    await requestApp()
      .post(`/api/v1/users/${author.id}/block`)
      .set(authHeaders(actor.id))
      .send({})
      .expect(201);

    const stored = await query(
      `SELECT source_review_id
       FROM user_blocks
       WHERE blocker_user_id = $1 AND blocked_user_id = $2`,
      [actor.id, author.id],
    );
    expect(stored.rows[0].source_review_id).toBeNull();

    await requestApp()
      .delete(`/api/v1/reviews/${review.id}/block-author`)
      .set(authHeaders(actor.id))
      .expect(200);

    const afterUnblock = await query(
      `SELECT deleted_at
       FROM user_blocks
       WHERE blocker_user_id = $1 AND blocked_user_id = $2`,
      [actor.id, author.id],
    );
    expect(afterUnblock.rows[0].deleted_at).not.toBeNull();
  });

  it('rejects self-block through a public review and writes no row', async () => {
    const author = await newUser({ displayName: 'Self Review Author' });
    const restaurant = await newRestaurant({ name: 'Self Block Restaurant' });
    const review = await newReview({
      userId: author.id,
      restaurantId: restaurant.id,
      status: 'VERIFIED',
      publicVisibility: 'PUBLIC',
    });

    const response = await requestApp()
      .post(`/api/v1/reviews/${review.id}/block-author`)
      .set(authHeaders(author.id))
      .send({})
      .expect(400);
    expect(response.body.error.code).toBe('CANNOT_BLOCK_SELF');

    const rows = await query(
      'SELECT id FROM user_blocks WHERE blocker_user_id = $1',
      [author.id],
    );
    expect(rows.rows).toHaveLength(0);
  });

  it('returns 404 for private and nonexistent reviews without leaking authors', async () => {
    const actor = await newUser({ displayName: 'Private Block Actor' });
    const author = await newUser({ displayName: 'Private Block Author' });
    const restaurant = await newRestaurant({ name: 'Private Block Restaurant' });
    const privateReview = await newReview({
      userId: author.id,
      restaurantId: restaurant.id,
      status: 'VERIFIED',
      publicVisibility: 'PRIVATE',
    });
    const missingId = '99999999-9999-4999-8999-999999999999';

    for (const reviewId of [privateReview.id, missingId]) {
      const response = await requestApp()
        .post(`/api/v1/reviews/${reviewId}/block-author`)
        .set(authHeaders(actor.id))
        .send({})
        .expect(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(JSON.stringify(response.body)).not.toContain(author.id);
    }

    const invalid = await requestApp()
      .delete('/api/v1/reviews/not-a-uuid/block-author')
      .set(authHeaders(actor.id))
      .expect(422);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
  });
});
