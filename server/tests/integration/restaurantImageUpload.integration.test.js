import '../helpers/env.js';
import crypto from 'node:crypto';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const originalTrustedAuthHeaders = process.env.TRUSTBITE_TRUSTED_AUTH_HEADERS;
const originalBucketName = process.env.AWS_RESTAURANT_IMAGES_BUCKET_NAME;
const originalSignedUrlTtl = process.env.TRUSTBITE_RESTAURANT_IMAGE_SIGNED_URL_TTL_SECONDS;

process.env.TRUSTBITE_TRUSTED_AUTH_HEADERS = 'true';
process.env.AWS_RESTAURANT_IMAGES_BUCKET_NAME = 'trustbite-test-restaurant-images';
process.env.TRUSTBITE_RESTAURANT_IMAGE_SIGNED_URL_TTL_SECONDS = '900';

let closeDbPool;
let createRestaurant;
let createUser;
let query;
let requestApp;
let storageService;

const authHeaders = (userId) => ({
  'x-trustbite-user-id': userId,
});

const validJpeg = () => Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
  0x49, 0x46, 0x00, 0x01, 0xff, 0xd9,
]);

async function assignRole(userId, roleId = 'ADMIN') {
  await query(
    `INSERT INTO roles (id, label)
     VALUES ($1, $2)
     ON CONFLICT (id) DO NOTHING`,
    [roleId, roleId],
  );
  await query(
    `INSERT INTO user_roles (user_id, role_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, role_id) DO NOTHING`,
    [userId, roleId],
  );
}

async function createMerchantAssignment({
  userId,
  restaurantId,
  permissionLevel = 'MANAGER',
  merchantStatus = 'ACTIVE',
  assignmentStatus = 'ACTIVE',
}) {
  await assignRole(userId, 'MERCHANT');
  const merchant = await query(
    `INSERT INTO merchants (user_id, business_name, status)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [userId, `Merchant ${userId}`, merchantStatus],
  );
  await query(
    `INSERT INTO restaurant_merchants (
       restaurant_id,
       merchant_id,
       permission_level,
       status
     )
     VALUES ($1, $2, $3, $4)`,
    [restaurantId, merchant.rows[0].id, permissionLevel, assignmentStatus],
  );
  return merchant.rows[0];
}

async function cleanup({ userIds = [], restaurantIds = [] } = {}) {
  if (userIds.length > 0) {
    await query('DELETE FROM audit_logs WHERE actor_id = ANY($1::uuid[])', [userIds]);
    await query('DELETE FROM idempotency_keys WHERE user_id = ANY($1::uuid[])', [userIds]);
    await query(
      `DELETE FROM restaurant_merchants
       WHERE merchant_id IN (SELECT id FROM merchants WHERE user_id = ANY($1::uuid[]))`,
      [userIds],
    );
    await query(
      `DELETE FROM restaurant_claims
       WHERE merchant_id IN (SELECT id FROM merchants WHERE user_id = ANY($1::uuid[]))`,
      [userIds],
    );
    await query('DELETE FROM merchants WHERE user_id = ANY($1::uuid[])', [userIds]);
    await query('DELETE FROM user_roles WHERE user_id = ANY($1::uuid[])', [userIds]);
  }
  if (restaurantIds.length > 0) {
    await query('DELETE FROM restaurants WHERE id = ANY($1::uuid[])', [restaurantIds]);
  }
  if (userIds.length > 0) {
    await query('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]);
  }
}

function restoreEnv() {
  const restore = (key, value) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  };

  restore('TRUSTBITE_TRUSTED_AUTH_HEADERS', originalTrustedAuthHeaders);
  restore('AWS_RESTAURANT_IMAGES_BUCKET_NAME', originalBucketName);
  restore('TRUSTBITE_RESTAURANT_IMAGE_SIGNED_URL_TTL_SECONDS', originalSignedUrlTtl);
}

describe('restaurant image upload API', () => {
  beforeAll(async () => {
    ({ closeDbPool, query } = await import('../helpers/db.js'));
    ({ createRestaurant, createUser } = await import('../helpers/factories/index.js'));
    ({ requestApp } = await import('../helpers/http.js'));
    storageService = await import('../../src/services/s3RestaurantImageStorageService.js');
  });

  afterAll(async () => {
    try {
      restoreEnv();
    } finally {
      await closeDbPool();
    }
  });

  beforeEach(() => {
    let signature = 0;
    storageService.setRestaurantImageSignerForTests(
      vi.fn(async (_client, command) => {
        signature += 1;
        return `https://signed-s3.test/${command.input.Key}?X-Amz-Signature=${signature}`;
      }),
    );
  });

  afterEach(() => {
    storageService.resetRestaurantImageSignerForTests();
    vi.restoreAllMocks();
  });

  it('rejects unauthenticated and non-admin uploads before S3 access', async () => {
    const restaurant = await createRestaurant();
    const user = await createUser({ displayName: 'Regular Image User' });
    const send = vi.fn();
    storageService.setS3RestaurantImageClientForTests({ send });

    try {
      await requestApp()
        .post(`/api/v1/restaurants/${restaurant.id}/images`)
        .set('Idempotency-Key', crypto.randomUUID())
        .attach('restaurantImage', validJpeg(), 'restaurant.jpg')
        .expect(401);

      await requestApp()
        .post(`/api/v1/restaurants/${restaurant.id}/images`)
        .set(authHeaders(user.id))
        .set('Idempotency-Key', crypto.randomUUID())
        .attach('restaurantImage', validJpeg(), 'restaurant.jpg')
        .expect(403);

      expect(send).not.toHaveBeenCalled();
    } finally {
      await cleanup({ userIds: [user.id], restaurantIds: [restaurant.id] });
    }
  });

  it('rejects invalid upload metadata before buffering the multipart body', async () => {
    const admin = await createUser({ displayName: 'Metadata Image Admin' });
    await assignRole(admin.id);
    const send = vi.fn();
    storageService.setS3RestaurantImageClientForTests({ send });

    try {
      await requestApp()
        .post('/api/v1/restaurants/not-a-uuid/images')
        .set(authHeaders(admin.id))
        .set('Idempotency-Key', crypto.randomUUID())
        .attach('restaurantImage', validJpeg(), 'restaurant.jpg')
        .expect(400);

      await requestApp()
        .post(`/api/v1/restaurants/${crypto.randomUUID()}/images`)
        .set(authHeaders(admin.id))
        .attach('restaurantImage', validJpeg(), 'restaurant.jpg')
        .expect(400);

      expect(send).not.toHaveBeenCalled();
    } finally {
      await cleanup({ userIds: [admin.id] });
    }
  });

  it('allows active owners and managers but rejects staff image uploads', async () => {
    const restaurant = await createRestaurant();
    const otherRestaurant = await createRestaurant();
    const manager = await createUser({ displayName: 'Restaurant Image Manager' });
    const staff = await createUser({ displayName: 'Restaurant Image Staff' });
    await createMerchantAssignment({
      userId: manager.id,
      restaurantId: restaurant.id,
      permissionLevel: 'MANAGER',
    });
    await createMerchantAssignment({
      userId: staff.id,
      restaurantId: restaurant.id,
      permissionLevel: 'STAFF',
    });
    const send = vi.fn(async () => ({}));
    storageService.setS3RestaurantImageClientForTests({ send });

    try {
      const response = await requestApp()
        .post(`/api/v1/restaurants/${restaurant.id}/images`)
        .set(authHeaders(manager.id))
        .set('Idempotency-Key', crypto.randomUUID())
        .attach('restaurantImage', validJpeg(), 'manager.jpg')
        .expect(201);

      expect(response.body.restaurantId).toBe(restaurant.id);

      await requestApp()
        .post(`/api/v1/restaurants/${restaurant.id}/images`)
        .set(authHeaders(staff.id))
        .set('Idempotency-Key', crypto.randomUUID())
        .attach('restaurantImage', validJpeg(), 'staff.jpg')
        .expect(403);

      await requestApp()
        .post(`/api/v1/restaurants/${otherRestaurant.id}/images`)
        .set(authHeaders(manager.id))
        .set('Idempotency-Key', crypto.randomUUID())
        .attach('restaurantImage', validJpeg(), 'cross-restaurant.jpg')
        .expect(403);

      expect(send.mock.calls.filter(([command]) => command.constructor.name === 'PutObjectCommand')).toHaveLength(1);
    } finally {
      await cleanup({
        userIds: [manager.id, staff.id],
        restaurantIds: [restaurant.id, otherRestaurant.id],
      });
    }
  });

  it('deletes the uploaded object when merchant access is revoked before persistence', async () => {
    const restaurant = await createRestaurant();
    const manager = await createUser({ displayName: 'Revoked Image Manager' });
    const merchant = await createMerchantAssignment({
      userId: manager.id,
      restaurantId: restaurant.id,
      permissionLevel: 'MANAGER',
    });
    const send = vi.fn(async (command) => {
      if (command.constructor.name === 'PutObjectCommand') {
        await query(
          `UPDATE restaurant_merchants
           SET status = 'INACTIVE'
           WHERE restaurant_id = $1
             AND merchant_id = $2`,
          [restaurant.id, merchant.id],
        );
      }
      return {};
    });
    storageService.setS3RestaurantImageClientForTests({ send });

    try {
      await requestApp()
        .post(`/api/v1/restaurants/${restaurant.id}/images`)
        .set(authHeaders(manager.id))
        .set('Idempotency-Key', crypto.randomUUID())
        .attach('restaurantImage', validJpeg(), 'revoked-manager.jpg')
        .expect(403);

      expect(send.mock.calls.map(([command]) => command.constructor.name)).toEqual([
        'PutObjectCommand',
        'DeleteObjectCommand',
      ]);
      const stored = await query(
        `SELECT id
         FROM restaurant_images
         WHERE restaurant_id = $1`,
        [restaurant.id],
      );
      expect(stored.rowCount).toBe(0);
    } finally {
      await cleanup({
        userIds: [manager.id],
        restaurantIds: [restaurant.id],
      });
    }
  });

  it('uploads, persists, audits, exposes, and replays a primary image', async () => {
    const restaurant = await createRestaurant();
    const admin = await createUser({ displayName: 'Restaurant Image Admin' });
    await assignRole(admin.id);
    const idempotencyKey = crypto.randomUUID();
    const send = vi.fn(async () => ({}));
    storageService.setS3RestaurantImageClientForTests({ send });

    const upload = () => requestApp()
      .post(`/api/v1/restaurants/${restaurant.id}/images`)
      .set(authHeaders(admin.id))
      .set('Idempotency-Key', idempotencyKey)
      .field('caption', '  Dining room  ')
      .field('isPrimary', 'true')
      .attach('restaurantImage', validJpeg(), 'restaurant.jpg');

    try {
      const response = await upload().expect(201);

      expect(response.body).toMatchObject({
        restaurantId: restaurant.id,
        branchId: null,
        caption: 'Dining room',
        isPrimary: true,
      });
      expect(response.body.imageUrl).toMatch(
        new RegExp(`^https://signed-s3\\.test/restaurant-images/${restaurant.id}/[0-9a-f-]+\\.jpg\\?X-Amz-Signature=1$`),
      );

      const persisted = await query(
        `SELECT restaurant_id, branch_id, image_url, caption, is_primary
         FROM restaurant_images
         WHERE id = $1`,
        [response.body.id],
      );
      expect(persisted.rows[0]).toMatchObject({
        restaurant_id: restaurant.id,
        branch_id: null,
        image_url: expect.stringMatching(
          new RegExp(`^s3://trustbite-test-restaurant-images/restaurant-images/${restaurant.id}/[0-9a-f-]+\\.jpg$`),
        ),
        caption: 'Dining room',
        is_primary: true,
      });

      const audit = await query(
        `SELECT action, entity_type, entity_id, actor_id, actor_role, metadata
         FROM audit_logs
         WHERE entity_id = $1`,
        [response.body.id],
      );
      expect(audit.rows[0]).toMatchObject({
        action: 'RESTAURANT_IMAGE_UPLOADED',
        entity_type: 'RESTAURANT_IMAGE',
        entity_id: response.body.id,
        actor_id: admin.id,
        actor_role: 'ADMIN',
        metadata: {
          restaurantId: restaurant.id,
          isPrimary: true,
        },
      });

      const detail = await requestApp()
        .get(`/api/v1/restaurants/${restaurant.id}`)
        .expect(200);
      expect(detail.body.primaryImageUrl).toMatch(
        new RegExp(`^https://signed-s3\\.test/restaurant-images/${restaurant.id}/[0-9a-f-]+\\.jpg\\?X-Amz-Signature=2$`),
      );

      const replay = await upload().expect(201);
      expect(replay.headers['idempotency-replayed']).toBe('true');
      expect(replay.body).toMatchObject({
        id: response.body.id,
        restaurantId: restaurant.id,
        imageUrl: expect.stringMatching(
          new RegExp(`^https://signed-s3\\.test/restaurant-images/${restaurant.id}/[0-9a-f-]+\\.jpg\\?X-Amz-Signature=3$`),
        ),
      });
      expect(send).toHaveBeenCalledTimes(1);

      await requestApp()
        .post(`/api/v1/restaurants/${restaurant.id}/images`)
        .set(authHeaders(admin.id))
        .set('Idempotency-Key', idempotencyKey)
        .field('caption', 'Different caption')
        .attach('restaurantImage', validJpeg(), 'restaurant.jpg')
        .expect(409);
    } finally {
      await cleanup({ userIds: [admin.id], restaurantIds: [restaurant.id] });
    }
  });

  it('atomically replaces the existing restaurant-level primary image', async () => {
    const restaurant = await createRestaurant();
    const admin = await createUser({ displayName: 'Primary Image Admin' });
    await assignRole(admin.id, 'SUPER_ADMIN');
    const previous = await query(
      `INSERT INTO restaurant_images (restaurant_id, image_url, is_primary)
       VALUES ($1, 'https://images.trustbite.test/restaurant-images/old.jpg', TRUE)
       RETURNING id`,
      [restaurant.id],
    );
    storageService.setS3RestaurantImageClientForTests({
      send: vi.fn(async () => ({})),
    });

    try {
      const response = await requestApp()
        .post(`/api/v1/restaurants/${restaurant.id}/images`)
        .set(authHeaders(admin.id))
        .set('Idempotency-Key', crypto.randomUUID())
        .attach('restaurantImage', validJpeg(), 'replacement.jpg')
        .expect(201);

      expect(response.body.isPrimary).toBe(true);
      const rows = await query(
        `SELECT id, is_primary
         FROM restaurant_images
         WHERE restaurant_id = $1
         ORDER BY created_at`,
        [restaurant.id],
      );
      expect(rows.rows).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: previous.rows[0].id, is_primary: false }),
        expect.objectContaining({ id: response.body.id, is_primary: true }),
      ]));
    } finally {
      await cleanup({ userIds: [admin.id], restaurantIds: [restaurant.id] });
    }
  });

  it('allows the same idempotency key to retry after a provider failure', async () => {
    const restaurant = await createRestaurant();
    const admin = await createUser({ displayName: 'Retry Image Admin' });
    await assignRole(admin.id);
    const idempotencyKey = crypto.randomUUID();
    const send = vi.fn()
      .mockRejectedValueOnce(new Error('temporary S3 failure'))
      .mockResolvedValueOnce({});
    storageService.setS3RestaurantImageClientForTests({ send });

    const upload = () => requestApp()
      .post(`/api/v1/restaurants/${restaurant.id}/images`)
      .set(authHeaders(admin.id))
      .set('Idempotency-Key', idempotencyKey)
      .attach('restaurantImage', validJpeg(), 'restaurant.jpg');

    try {
      await upload().expect(503);
      const response = await upload().expect(201);

      expect(response.body.restaurantId).toBe(restaurant.id);
      expect(send.mock.calls.map(([command]) => command.constructor.name)).toEqual([
        'PutObjectCommand',
        'DeleteObjectCommand',
        'PutObjectCommand',
      ]);
    } finally {
      await cleanup({ userIds: [admin.id], restaurantIds: [restaurant.id] });
    }
  });

  it('lists managed images and idempotently deletes a primary image with promotion', async () => {
    const restaurant = await createRestaurant();
    const manager = await createUser({ displayName: 'Restaurant Image Delete Manager' });
    await createMerchantAssignment({
      userId: manager.id,
      restaurantId: restaurant.id,
      permissionLevel: 'OWNER',
    });
    const firstImageId = crypto.randomUUID();
    const secondImageId = crypto.randomUUID();
    const firstObjectId = crypto.randomUUID();
    const secondObjectId = crypto.randomUUID();
    await query(
      `INSERT INTO restaurant_images (
         id,
         restaurant_id,
         image_url,
         caption,
         is_primary,
         created_at
       )
       VALUES
         ($1, $3, $4, 'Old primary', TRUE, NOW() - INTERVAL '1 minute'),
         ($2, $3, $5, 'Next primary', FALSE, NOW())`,
      [
        firstImageId,
        secondImageId,
        restaurant.id,
        `s3://trustbite-test-restaurant-images/restaurant-images/${restaurant.id}/${firstObjectId}.jpg`,
        `s3://trustbite-test-restaurant-images/restaurant-images/${restaurant.id}/${secondObjectId}.jpg`,
      ],
    );
    const send = vi.fn(async () => ({}));
    storageService.setS3RestaurantImageClientForTests({ send });
    const idempotencyKey = crypto.randomUUID();

    try {
      const list = await requestApp()
        .get(`/api/v1/restaurants/${restaurant.id}/images`)
        .set(authHeaders(manager.id))
        .expect(200);
      expect(list.body.items).toHaveLength(2);
      expect(list.body.items[0].imageUrl).toContain('X-Amz-Signature=');

      const remove = () => requestApp()
        .delete(`/api/v1/restaurants/${restaurant.id}/images/${firstImageId}`)
        .set(authHeaders(manager.id))
        .set('Idempotency-Key', idempotencyKey);

      const response = await remove().expect(200);
      expect(response.body).toMatchObject({
        id: firstImageId,
        restaurantId: restaurant.id,
        deleted: true,
        wasPrimary: true,
        promotedPrimaryImageId: secondImageId,
      });

      const replay = await remove().expect(200);
      expect(replay.headers['idempotency-replayed']).toBe('true');
      expect(replay.body).toEqual(response.body);

      const rows = await query(
        `SELECT id, is_primary
         FROM restaurant_images
         WHERE restaurant_id = $1`,
        [restaurant.id],
      );
      expect(rows.rows).toEqual([{
        id: secondImageId,
        is_primary: true,
      }]);
      expect(send.mock.calls.map(([command]) => command.constructor.name)).toEqual([
        'DeleteObjectCommand',
      ]);
    } finally {
      await cleanup({ userIds: [manager.id], restaurantIds: [restaurant.id] });
    }
  });

  it('retries S3 cleanup without recreating a deleted image or duplicate audit row', async () => {
    const restaurant = await createRestaurant();
    const admin = await createUser({ displayName: 'Restaurant Image Cleanup Admin' });
    await assignRole(admin.id, 'ADMIN');
    const imageId = crypto.randomUUID();
    await query(
      `INSERT INTO restaurant_images (
         id,
         restaurant_id,
         image_url,
         is_primary
       )
       VALUES ($1, $2, $3, TRUE)`,
      [
        imageId,
        restaurant.id,
        `s3://trustbite-test-restaurant-images/restaurant-images/${restaurant.id}/${crypto.randomUUID()}.jpg`,
      ],
    );
    let deleteAttempts = 0;
    const send = vi.fn(async (command) => {
      if (command.constructor.name === 'DeleteObjectCommand') {
        deleteAttempts += 1;
        if (deleteAttempts === 1) throw new Error('temporary S3 failure');
      }
      return {};
    });
    storageService.setS3RestaurantImageClientForTests({ send });
    const idempotencyKey = crypto.randomUUID();
    const remove = () => requestApp()
      .delete(`/api/v1/restaurants/${restaurant.id}/images/${imageId}`)
      .set(authHeaders(admin.id))
      .set('Idempotency-Key', idempotencyKey);

    try {
      await remove().expect(503);
      const afterFailure = await query(
        'SELECT id FROM restaurant_images WHERE id = $1',
        [imageId],
      );
      expect(afterFailure.rowCount).toBe(0);

      const retry = await remove().expect(200);
      expect(retry.body).toMatchObject({
        id: imageId,
        deleted: true,
      });
      expect(deleteAttempts).toBe(2);

      const audits = await query(
        `SELECT id
         FROM audit_logs
         WHERE action = 'RESTAURANT_IMAGE_DELETED'
           AND entity_id = $1`,
        [imageId],
      );
      expect(audits.rowCount).toBe(1);
    } finally {
      await cleanup({ userIds: [admin.id], restaurantIds: [restaurant.id] });
    }
  });

  it('rejects invalid files and soft-deleted restaurants without uploading', async () => {
    const restaurant = await createRestaurant({ isDeleted: true });
    const admin = await createUser({ displayName: 'Invalid Image Admin' });
    await assignRole(admin.id);
    const send = vi.fn();
    storageService.setS3RestaurantImageClientForTests({ send });

    try {
      await requestApp()
        .post(`/api/v1/restaurants/${restaurant.id}/images`)
        .set(authHeaders(admin.id))
        .set('Idempotency-Key', crypto.randomUUID())
        .attach('restaurantImage', Buffer.from('not-an-image'), 'restaurant.txt')
        .expect(415);

      await requestApp()
        .post(`/api/v1/restaurants/${restaurant.id}/images`)
        .set(authHeaders(admin.id))
        .set('Idempotency-Key', crypto.randomUUID())
        .attach('restaurantImage', validJpeg(), 'restaurant.jpg')
        .expect(404);

      expect(send).not.toHaveBeenCalled();
    } finally {
      await cleanup({ userIds: [admin.id], restaurantIds: [restaurant.id] });
    }
  });
});
