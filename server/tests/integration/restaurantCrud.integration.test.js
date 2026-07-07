import '../helpers/env.js';
import crypto from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const originalTrustedAuthHeaders = process.env.TRUSTBITE_TRUSTED_AUTH_HEADERS;

let closeDbPool;
let createUser;
let query;
let requestApp;

const authHeaders = (userId) => ({
  'x-trustbite-user-id': userId,
});

async function cleanupUsers(userIds) {
  if (userIds.length === 0) return;
  await query('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]);
}

async function cleanupRestaurants(restaurantIds) {
  if (restaurantIds.length === 0) return;
  await query('DELETE FROM restaurants WHERE id = ANY($1::uuid[])', [restaurantIds]);
}

async function cleanupCategories(categoryIds) {
  if (categoryIds.length === 0) return;
  await query('DELETE FROM restaurant_categories WHERE id = ANY($1::int[])', [categoryIds]);
}

async function createCategory(label) {
  const suffix = `${Date.now()}-${crypto.randomInt(1_000_000)}`;
  const result = await query(
    `INSERT INTO restaurant_categories (code, label)
     VALUES ($1, $2)
     RETURNING id`,
    [`test-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${suffix}`, label],
  );
  return result.rows[0];
}

async function readRestaurantGeo(restaurantId) {
  const result = await query(
    `SELECT
       latitude::float8 AS latitude,
       longitude::float8 AS longitude,
       CASE WHEN geo IS NULL THEN NULL ELSE ST_Y(geo::geometry)::float8 END AS geo_latitude,
       CASE WHEN geo IS NULL THEN NULL ELSE ST_X(geo::geometry)::float8 END AS geo_longitude,
       is_deleted,
       deleted_at,
       status
     FROM restaurants
     WHERE id = $1`,
    [restaurantId],
  );
  return result.rows[0];
}

async function readCategoryMappings(restaurantId) {
  const result = await query(
    `SELECT category_id
     FROM restaurant_category_map
     WHERE restaurant_id = $1
     ORDER BY category_id ASC`,
    [restaurantId],
  );
  return result.rows.map((row) => row.category_id);
}

function restoreTestEnv() {
  if (originalTrustedAuthHeaders === undefined) {
    delete process.env.TRUSTBITE_TRUSTED_AUTH_HEADERS;
  } else {
    process.env.TRUSTBITE_TRUSTED_AUTH_HEADERS = originalTrustedAuthHeaders;
  }
}

describe('restaurant CRUD API', () => {
  beforeAll(async () => {
    process.env.TRUSTBITE_TRUSTED_AUTH_HEADERS = 'true';

    ({ closeDbPool, query } = await import('../helpers/db.js'));
    ({ createUser } = await import('../helpers/factories/index.js'));
    ({ requestApp } = await import('../helpers/http.js'));
  });

  afterAll(async () => {
    try {
      restoreTestEnv();
    } finally {
      if (closeDbPool) {
        await closeDbPool();
      }
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects mutating routes without authenticated identity', async () => {
    const response = await requestApp()
      .post('/api/v1/restaurants')
      .send({ name: 'Unauthenticated Restaurant' })
      .expect(401);

    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });

  it('returns a validation error when category_ids reference unknown categories', async () => {
    const user = await createUser({ displayName: 'Restaurant CRUD Operator' });

    try {
      const response = await requestApp()
        .post('/api/v1/restaurants')
        .set(authHeaders(user.id))
        .send({
          name: 'Unknown Category Test',
          category_ids: [999_999],
        })
        .expect(422);

      expect(response.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'Invalid category_ids: 999999.',
      });
    } finally {
      await cleanupUsers([user.id]);
    }
  });

  it('creates a restaurant with category mappings and synchronized geo coordinates', async () => {
    const user = await createUser({ displayName: 'Restaurant Creator' });
    const firstCategory = await createCategory('Vietnamese');
    const secondCategory = await createCategory('Dessert');
    let restaurantId;

    try {
      const response = await requestApp()
        .post('/api/v1/restaurants')
        .set(authHeaders(user.id))
        .send({
          name: 'Pho Category Geo',
          description: 'Schema-backed restaurant create proof',
          address: '1 Test Street',
          phone_number: '+84123456789',
          latitude: 10.7769,
          longitude: 106.7009,
          category_ids: [firstCategory.id, secondCategory.id, firstCategory.id],
        })
        .expect(201);

      restaurantId = response.body.id;
      expect(response.body).toMatchObject({
        name: 'Pho Category Geo',
        description: 'Schema-backed restaurant create proof',
        address: '1 Test Street',
        phoneNumber: '+84123456789',
        latitude: 10.7769,
        longitude: 106.7009,
      });
      expect(response.body.categoryIds).toEqual(expect.arrayContaining([firstCategory.id, secondCategory.id]));
      expect(response.body.categoryIds).toHaveLength(2);

      const persisted = await readRestaurantGeo(restaurantId);
      expect(persisted).toMatchObject({
        latitude: 10.7769,
        longitude: 106.7009,
        geo_latitude: 10.7769,
        geo_longitude: 106.7009,
        is_deleted: false,
      });

      const mappings = await readCategoryMappings(restaurantId);
      expect(mappings).toEqual([firstCategory.id, secondCategory.id].sort((a, b) => a - b));
    } finally {
      await cleanupRestaurants(restaurantId ? [restaurantId] : []);
      await cleanupCategories([firstCategory.id, secondCategory.id]);
      await cleanupUsers([user.id]);
    }
  });

  it('retries slug generation when a generated restaurant slug collides', async () => {
    const user = await createUser({ displayName: 'Slug Retry Operator' });
    const existing = await query(
      `INSERT INTO restaurants (name, slug, status)
       VALUES ($1, $2, 'DRAFT')
       RETURNING id`,
      ['Existing Collision Cafe', 'collision-cafe-000001'],
    );
    let createdId;

    vi.spyOn(crypto, 'randomBytes')
      .mockReturnValueOnce(Buffer.from('000001', 'hex'))
      .mockReturnValueOnce(Buffer.from('000002', 'hex'));

    try {
      const response = await requestApp()
        .post('/api/v1/restaurants')
        .set(authHeaders(user.id))
        .send({ name: 'Collision Cafe' })
        .expect(201);

      createdId = response.body.id;
      expect(response.body.slug).toBe('collision-cafe-000002');
    } finally {
      await cleanupRestaurants([existing.rows[0].id, createdId].filter(Boolean));
      await cleanupUsers([user.id]);
    }
  });

  it('updates accepted fields, replaces categories, and can clear geo coordinates', async () => {
    const user = await createUser({ displayName: 'Restaurant Updater' });
    const originalCategory = await createCategory('Original');
    const replacementCategory = await createCategory('Replacement');
    let restaurantId;

    try {
      const created = await requestApp()
        .post('/api/v1/restaurants')
        .set(authHeaders(user.id))
        .send({
          name: 'Update Source',
          latitude: 10.7,
          longitude: 106.6,
          category_ids: [originalCategory.id],
        })
        .expect(201);
      restaurantId = created.body.id;

      const updated = await requestApp()
        .patch(`/api/v1/restaurants/${restaurantId}`)
        .set(authHeaders(user.id))
        .send({
          name: 'Update Target',
          status: 'ACTIVE',
          latitude: 10.8,
          longitude: 106.7,
          category_ids: [replacementCategory.id],
        })
        .expect(200);

      expect(updated.body).toMatchObject({
        id: restaurantId,
        name: 'Update Target',
        status: 'ACTIVE',
        latitude: 10.8,
        longitude: 106.7,
        categoryIds: [replacementCategory.id],
      });

      let persisted = await readRestaurantGeo(restaurantId);
      expect(persisted).toMatchObject({
        latitude: 10.8,
        longitude: 106.7,
        geo_latitude: 10.8,
        geo_longitude: 106.7,
        status: 'ACTIVE',
      });
      await expect(readCategoryMappings(restaurantId)).resolves.toEqual([replacementCategory.id]);

      const cleared = await requestApp()
        .patch(`/api/v1/restaurants/${restaurantId}`)
        .set(authHeaders(user.id))
        .send({ latitude: null, longitude: null })
        .expect(200);

      expect(cleared.body).toMatchObject({
        id: restaurantId,
        latitude: null,
        longitude: null,
      });
      persisted = await readRestaurantGeo(restaurantId);
      expect(persisted).toMatchObject({
        latitude: null,
        longitude: null,
        geo_latitude: null,
        geo_longitude: null,
      });
    } finally {
      await cleanupRestaurants(restaurantId ? [restaurantId] : []);
      await cleanupCategories([originalCategory.id, replacementCategory.id]);
      await cleanupUsers([user.id]);
    }
  });

  it('soft-deletes a restaurant and removes it from public reads', async () => {
    const user = await createUser({ displayName: 'Restaurant Deleter' });
    let restaurantId;

    try {
      const created = await requestApp()
        .post('/api/v1/restaurants')
        .set(authHeaders(user.id))
        .send({ name: 'Delete Target' })
        .expect(201);
      restaurantId = created.body.id;

      await requestApp()
        .patch(`/api/v1/restaurants/${restaurantId}`)
        .set(authHeaders(user.id))
        .send({ status: 'ACTIVE' })
        .expect(200);

      const deleted = await requestApp()
        .delete(`/api/v1/restaurants/${restaurantId}`)
        .set(authHeaders(user.id))
        .expect(200);
      expect(deleted.body).toMatchObject({ success: true });

      const persisted = await readRestaurantGeo(restaurantId);
      expect(persisted.is_deleted).toBe(true);
      expect(persisted.deleted_at).toBeTruthy();

      const listResponse = await requestApp()
        .get('/api/v1/restaurants')
        .query({ keyword: 'Delete Target' })
        .expect(200);
      expect(listResponse.body.items.map((item) => item.id)).not.toContain(restaurantId);

      const detailResponse = await requestApp()
        .get(`/api/v1/restaurants/${restaurantId}`)
        .expect(404);
      expect(detailResponse.body.error.code).toBe('RESTAURANT_NOT_FOUND');
    } finally {
      await cleanupRestaurants(restaurantId ? [restaurantId] : []);
      await cleanupUsers([user.id]);
    }
  });
});
