import '../helpers/env.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let closeDbPool;
let createRestaurant;
let createReview;
let createUser;
let query;
let requestApp;

const authHeaders = (userId) => ({ 'x-trustbite-user-id': userId });

describe('authenticated review reactions API', () => {
  beforeAll(async () => {
    ({ closeDbPool, query } = await import('../helpers/db.js'));
    ({ createRestaurant, createReview, createUser } = await import('../helpers/factories/index.js'));
    ({ requestApp } = await import('../helpers/http.js'));
  });

  afterAll(async () => {
    if (closeDbPool) await closeDbPool();
  });

  it('creates, replaces, aggregates, and removes one reaction per authenticated user', async () => {
    const author = await createUser({ displayName: 'Reaction Author' });
    const actor = await createUser({ displayName: 'Reaction Actor' });
    const spoofed = await createUser({ displayName: 'Spoofed Actor' });
    const restaurant = await createRestaurant({
      slug: `reaction-${Date.now()}`,
      status: 'ACTIVE',
    });
    const review = await createReview({
      userId: author.id,
      restaurantId: restaurant.id,
      status: 'VERIFIED',
      publicVisibility: 'PUBLIC',
    });

    try {
      const created = await requestApp()
        .put(`/api/v1/reviews/${review.id}/reaction`)
        .set(authHeaders(actor.id))
        .send({ reactionType: 'LOVE', userId: spoofed.id })
        .expect(200);
      expect(created.body).toEqual({
        reviewId: review.id,
        myReaction: 'LOVE',
        reactionCounts: { LOVE: 1, HAHA: 0, ANGRY: 0 },
      });

      await requestApp()
        .put(`/api/v1/reviews/${review.id}/reaction`)
        .set(authHeaders(actor.id))
        .send({ reactionType: 'HAHA' })
        .expect(200);

      const stored = await query(
        `SELECT user_id, reaction_type
         FROM review_reactions
         WHERE review_id = $1`,
        [review.id],
      );
      expect(stored.rows).toEqual([
        { user_id: actor.id, reaction_type: 'HAHA' },
      ]);

      const publicReviews = await requestApp()
        .get(`/api/v1/restaurants/${restaurant.id}/reviews`)
        .expect(200);
      expect(publicReviews.body.items[0].reactionCounts).toEqual({
        LOVE: 0,
        HAHA: 1,
        ANGRY: 0,
      });
      expect(publicReviews.body.items[0]).not.toHaveProperty('myReaction');
      expect(publicReviews.body.items[0]).not.toHaveProperty('reactingUserIds');

      await requestApp()
        .delete(`/api/v1/reviews/${review.id}/reaction`)
        .set(authHeaders(actor.id))
        .expect(200);
      await requestApp()
        .delete(`/api/v1/reviews/${review.id}/reaction`)
        .set(authHeaders(actor.id))
        .expect(200);

      const remaining = await query(
        'SELECT COUNT(*)::int AS total FROM review_reactions WHERE review_id = $1',
        [review.id],
      );
      expect(remaining.rows[0].total).toBe(0);
    } finally {
      await query('DELETE FROM review_reactions WHERE review_id = $1', [review.id]);
      await query('DELETE FROM reviews WHERE id = $1', [review.id]);
      await query('DELETE FROM restaurants WHERE id = $1', [restaurant.id]);
      await query('DELETE FROM users WHERE id = ANY($1::uuid[])', [
        [author.id, actor.id, spoofed.id],
      ]);
    }
  });

  it('rejects unauthenticated, invalid, and non-public review reactions', async () => {
    const author = await createUser({ displayName: 'Private Reaction Author' });
    const actor = await createUser({ displayName: 'Private Reaction Actor' });
    const restaurant = await createRestaurant({
      slug: `private-reaction-${Date.now()}`,
      status: 'ACTIVE',
    });
    const review = await createReview({
      userId: author.id,
      restaurantId: restaurant.id,
      status: 'VERIFIED',
      publicVisibility: 'PRIVATE',
    });

    try {
      await requestApp()
        .put(`/api/v1/reviews/${review.id}/reaction`)
        .send({ reactionType: 'LOVE' })
        .expect(401);

      const invalidType = await requestApp()
        .put(`/api/v1/reviews/${review.id}/reaction`)
        .set(authHeaders(actor.id))
        .send({ reactionType: 'LIKE' })
        .expect(422);
      expect(invalidType.body.error.code).toBe('VALIDATION_ERROR');

      const hidden = await requestApp()
        .put(`/api/v1/reviews/${review.id}/reaction`)
        .set(authHeaders(actor.id))
        .send({ reactionType: 'ANGRY' })
        .expect(404);
      expect(hidden.body.error.code).toBe('NOT_FOUND');
    } finally {
      await query('DELETE FROM reviews WHERE id = $1', [review.id]);
      await query('DELETE FROM restaurants WHERE id = $1', [restaurant.id]);
      await query('DELETE FROM users WHERE id = ANY($1::uuid[])', [
        [author.id, actor.id],
      ]);
    }
  });
});
