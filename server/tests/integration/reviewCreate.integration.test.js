import '../helpers/env.js';
import { afterAll, afterEach, describe, expect, it } from 'vitest';

process.env.TRUSTBITE_TRUSTED_AUTH_HEADERS = 'true';

const { createUser, createRestaurant } = await import('../helpers/factories/index.js');
const { closeDbPool, deleteByIds, query } = await import('../helpers/db.js');
const { requestApp } = await import('../helpers/http.js');

const authHeaders = (userId) => ({
  'x-trustbite-user-id': userId,
});

const created = { users: [], restaurants: [], reviews: [] };

function validPayload(restaurantId, overrides = {}) {
  return {
    restaurantId,
    foodRating: 5,
    priceRating: 4,
    serviceRating: 5,
    ambienceRating: 4,
    comment: 'Mon an ngon, phuc vu tot, gia hop ly va khong gian sach se de chiu.',
    visitedAt: new Date(Date.now() - 60_000).toISOString(),
    ...overrides,
  };
}

describe('create review API', () => {
  afterEach(async () => {
    await deleteByIds('reviews', 'id', created.reviews);
    await deleteByIds('restaurants', 'id', created.restaurants);
    await deleteByIds('users', 'id', created.users);
    created.users = [];
    created.restaurants = [];
    created.reviews = [];
  });

  afterAll(async () => {
    await closeDbPool();
  });

  it('creates a submitted review for an authenticated active user', async () => {
    const user = await createUser({ displayName: 'Review Creator' });
    const restaurant = await createRestaurant({ name: 'Review Create Restaurant' });
    created.users.push(user.id);
    created.restaurants.push(restaurant.id);

    const response = await requestApp()
      .post('/api/v1/reviews')
      .set(authHeaders(user.id))
      .send(validPayload(restaurant.id))
      .expect(201);

    created.reviews.push(response.body.reviewId);
    expect(response.body).toEqual({
      reviewId: expect.any(String),
      status: 'SUBMITTED',
      nextStep: 'UPLOAD_RECEIPT',
    });

    const persisted = await query(
      `SELECT user_id, restaurant_id, status, verification_status, trust_label, public_visibility, trust_weight_bucket
       FROM reviews
       WHERE id = $1`,
      [response.body.reviewId],
    );
    expect(persisted.rows[0]).toMatchObject({
      user_id: user.id,
      restaurant_id: restaurant.id,
      status: 'SUBMITTED',
      verification_status: 'UNVERIFIED',
      trust_label: 'PENDING_VERIFICATION',
      public_visibility: 'PRIVATE_UNTIL_DECISION',
      trust_weight_bucket: 'NONE',
    });
  });

  it('rejects unauthenticated create requests at the route boundary', async () => {
    const restaurant = await createRestaurant({ name: 'Unauth Review Restaurant' });
    created.restaurants.push(restaurant.id);

    const response = await requestApp()
      .post('/api/v1/reviews')
      .send(validPayload(restaurant.id))
      .expect(401);

    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });

  it('rejects invalid review payloads before writing a review', async () => {
    const user = await createUser({ displayName: 'Invalid Review Creator' });
    const restaurant = await createRestaurant({ name: 'Invalid Review Restaurant' });
    created.users.push(user.id);
    created.restaurants.push(restaurant.id);

    const response = await requestApp()
      .post('/api/v1/reviews')
      .set(authHeaders(user.id))
      .send(validPayload(restaurant.id, { foodRating: 6 }))
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    const rows = await query('SELECT id FROM reviews WHERE user_id = $1', [user.id]);
    expect(rows.rowCount).toBe(0);
  });

  it('rolls back when the target restaurant is not active', async () => {
    const user = await createUser({ displayName: 'Inactive Restaurant Reviewer' });
    const restaurant = await createRestaurant({ name: 'Closed Review Restaurant', status: 'CLOSED' });
    created.users.push(user.id);
    created.restaurants.push(restaurant.id);

    const response = await requestApp()
      .post('/api/v1/reviews')
      .set(authHeaders(user.id))
      .send(validPayload(restaurant.id))
      .expect(422);

    expect(response.body.error.code).toBe('RESTAURANT_NOT_ACTIVE');
    const rows = await query('SELECT id FROM reviews WHERE user_id = $1', [user.id]);
    expect(rows.rowCount).toBe(0);
  });
});
