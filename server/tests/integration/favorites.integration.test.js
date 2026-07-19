import '../helpers/env.js';
import { afterAll, afterEach, describe, expect, it } from 'vitest';

process.env.TRUSTBITE_TRUSTED_AUTH_HEADERS = 'true';

const { createRestaurant, createUser } = await import('../helpers/factories/index.js');
const { closeDbPool, query } = await import('../helpers/db.js');
const { requestApp } = await import('../helpers/http.js');

const authHeaders = (userId) => ({
  'x-trustbite-user-id': userId,
});

const createdUserIds = new Set();
const createdRestaurantIds = new Set();

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

describe('favorites API', () => {
  afterEach(async () => {
    for (const userId of createdUserIds) {
      await query('DELETE FROM user_saved_lists WHERE user_id = $1', [userId]);
    }
    for (const restaurantId of createdRestaurantIds) {
      await query('DELETE FROM restaurants WHERE id = $1', [restaurantId]);
    }
    for (const userId of createdUserIds) {
      await query('DELETE FROM users WHERE id = $1', [userId]);
    }
    createdRestaurantIds.clear();
    createdUserIds.clear();
  });

  afterAll(async () => {
    await closeDbPool();
  });

  it('creates one private default list, saves idempotently, and lists newest first', async () => {
    const user = await newUser({ displayName: 'Favorites Owner' });
    const older = await newRestaurant({
      name: 'Older Favorite',
      trustScore: 4.2,
      verifiedReviewCount: 3,
    });
    const newer = await newRestaurant({
      name: 'Newer Favorite',
      trustScore: 4.8,
      verifiedReviewCount: 9,
    });

    await requestApp()
      .put(`/api/v1/users/me/favorites/${older.id}`)
      .set(authHeaders(user.id))
      .send({})
      .expect(201);

    const duplicate = await requestApp()
      .put(`/api/v1/users/me/favorites/${older.id}`)
      .set(authHeaders(user.id))
      .send({})
      .expect(200);
    expect(duplicate.body).toEqual({ saved: true });

    await requestApp()
      .put(`/api/v1/users/me/favorites/${newer.id}`)
      .set(authHeaders(user.id))
      .send({})
      .expect(201);

    const lists = await query(
      `SELECT id, name, is_public
       FROM user_saved_lists
       WHERE user_id = $1 AND name = 'Yêu thích'`,
      [user.id],
    );
    expect(lists.rows).toHaveLength(1);
    expect(lists.rows[0].is_public).toBe(false);

    await query(
      `UPDATE user_saved_list_restaurants
       SET added_at = added_at - interval '1 hour'
       WHERE saved_list_id = $1 AND restaurant_id = $2`,
      [lists.rows[0].id, older.id],
    );

    const response = await requestApp()
      .get('/api/v1/users/me/favorites')
      .set(authHeaders(user.id))
      .expect(200);

    expect(response.body.items).toEqual([
      expect.objectContaining({
        id: newer.id,
        name: 'Newer Favorite',
        primaryImageUrl: null,
        trustScore: 4.8,
        verifiedReviewCount: 9,
      }),
      expect.objectContaining({
        id: older.id,
        name: 'Older Favorite',
        primaryImageUrl: null,
        trustScore: 4.2,
        verifiedReviewCount: 3,
      }),
    ]);
    expect(response.body.items.every((item) => item.addedAt)).toBe(true);
  });

  it('keeps favorites scoped to the authenticated user', async () => {
    const owner = await newUser({ displayName: 'Favorite Owner' });
    const other = await newUser({ displayName: 'Other Favorite Owner' });
    const restaurant = await newRestaurant({ name: 'Scoped Favorite' });

    await requestApp()
      .put(`/api/v1/users/me/favorites/${restaurant.id}`)
      .set(authHeaders(owner.id))
      .send({})
      .expect(201);

    const otherList = await requestApp()
      .get('/api/v1/users/me/favorites')
      .set(authHeaders(other.id))
      .expect(200);
    expect(otherList.body).toEqual({ items: [] });

    await requestApp()
      .delete(`/api/v1/users/me/favorites/${restaurant.id}`)
      .set(authHeaders(other.id))
      .expect(200);

    const ownerList = await requestApp()
      .get('/api/v1/users/me/favorites')
      .set(authHeaders(owner.id))
      .expect(200);
    expect(ownerList.body.items).toHaveLength(1);
  });

  it('serializes concurrent first saves into one default list and one membership', async () => {
    const user = await newUser({ displayName: 'Concurrent Favorite Owner' });
    const restaurant = await newRestaurant({ name: 'Concurrent Favorite' });

    const responses = await Promise.all([
      requestApp()
        .put(`/api/v1/users/me/favorites/${restaurant.id}`)
        .set(authHeaders(user.id))
        .send({}),
      requestApp()
        .put(`/api/v1/users/me/favorites/${restaurant.id}`)
        .set(authHeaders(user.id))
        .send({}),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 201]);

    const lists = await query(
      `SELECT id
       FROM user_saved_lists
       WHERE user_id = $1 AND name = 'Yêu thích' AND is_public = FALSE`,
      [user.id],
    );
    expect(lists.rows).toHaveLength(1);

    const memberships = await query(
      `SELECT restaurant_id
       FROM user_saved_list_restaurants
       WHERE saved_list_id = $1`,
      [lists.rows[0].id],
    );
    expect(memberships.rows).toEqual([{ restaurant_id: restaurant.id }]);
  });

  it('rejects missing, deleted, and invalid restaurant identifiers without residue', async () => {
    const user = await newUser({ displayName: 'Invalid Favorite Owner' });
    const deleted = await newRestaurant({
      name: 'Deleted Favorite',
      isDeleted: true,
    });
    const missingId = '99999999-9999-4999-8999-999999999999';

    for (const restaurantId of [deleted.id, missingId]) {
      const response = await requestApp()
        .put(`/api/v1/users/me/favorites/${restaurantId}`)
        .set(authHeaders(user.id))
        .send({})
        .expect(404);
      expect(response.body.error.code).toBe('RESTAURANT_NOT_FOUND');
    }

    const invalid = await requestApp()
      .put('/api/v1/users/me/favorites/not-a-uuid')
      .set(authHeaders(user.id))
      .send({})
      .expect(422);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');

    const lists = await query(
      'SELECT COUNT(*)::int AS total FROM user_saved_lists WHERE user_id = $1',
      [user.id],
    );
    expect(lists.rows[0].total).toBe(0);
  });

  it('rejects inactive restaurants and hides saved restaurants that become inactive', async () => {
    const user = await newUser({ displayName: 'Active Favorites Owner' });
    const active = await newRestaurant({ name: 'Initially Active Favorite' });
    const inactiveRestaurants = await Promise.all([
      newRestaurant({ name: 'Draft Favorite', status: 'DRAFT' }),
      newRestaurant({ name: 'Suspended Favorite', status: 'SUSPENDED' }),
      newRestaurant({ name: 'Closed Favorite', status: 'CLOSED' }),
    ]);

    for (const restaurant of inactiveRestaurants) {
      const response = await requestApp()
        .put(`/api/v1/users/me/favorites/${restaurant.id}`)
        .set(authHeaders(user.id))
        .send({})
        .expect(404);
      expect(response.body.error.code).toBe('RESTAURANT_NOT_FOUND');
    }

    await requestApp()
      .put(`/api/v1/users/me/favorites/${active.id}`)
      .set(authHeaders(user.id))
      .send({})
      .expect(201);
    await query(
      `UPDATE restaurants SET status = 'SUSPENDED' WHERE id = $1`,
      [active.id],
    );

    const list = await requestApp()
      .get('/api/v1/users/me/favorites')
      .set(authHeaders(user.id))
      .expect(200);
    expect(list.body).toEqual({ items: [] });
  });

  it('removes favorites idempotently', async () => {
    const user = await newUser({ displayName: 'Remove Favorite Owner' });
    const restaurant = await newRestaurant({ name: 'Remove Favorite' });

    await requestApp()
      .put(`/api/v1/users/me/favorites/${restaurant.id}`)
      .set(authHeaders(user.id))
      .send({})
      .expect(201);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await requestApp()
        .delete(`/api/v1/users/me/favorites/${restaurant.id}`)
        .set(authHeaders(user.id))
        .expect(200);
      expect(response.body).toEqual({ success: true });
    }

    const remaining = await query(
      `SELECT COUNT(*)::int AS total
       FROM user_saved_list_restaurants saved
       JOIN user_saved_lists list ON list.id = saved.saved_list_id
       WHERE list.user_id = $1 AND saved.restaurant_id = $2`,
      [user.id, restaurant.id],
    );
    expect(remaining.rows[0].total).toBe(0);
  });
});
