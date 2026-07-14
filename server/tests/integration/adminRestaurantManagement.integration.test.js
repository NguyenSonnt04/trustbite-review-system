import crypto from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const originalBucket = process.env.AWS_RESTAURANT_IMAGES_BUCKET_NAME;
process.env.AWS_RESTAURANT_IMAGES_BUCKET_NAME = 'trustbite-test-restaurant-images';

let adminRestaurantManagementService;
let closeDbPool;
let createRestaurant;
let createUser;
let imageService;
let query;
let storageService;

const validJpeg = () => ({
  originalname: 'restaurant.jpg',
  mimetype: 'image/jpeg',
  size: 14,
  buffer: Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a,
    0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9,
  ]),
});

async function cleanup({ userIds = [], restaurantIds = [] }) {
  if (userIds.length > 0) {
    await query('DELETE FROM audit_logs WHERE actor_id = ANY($1::uuid[])', [userIds]);
    await query('DELETE FROM idempotency_keys WHERE user_id = ANY($1::uuid[])', [userIds]);
  }
  if (restaurantIds.length > 0) {
    await query('DELETE FROM restaurants WHERE id = ANY($1::uuid[])', [restaurantIds]);
  }
  if (userIds.length > 0) {
    await query('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]);
  }
}

describe('admin restaurant management', () => {
  beforeAll(async () => {
    ({ closeDbPool, query } = await import('../helpers/db.js'));
    ({ createRestaurant, createUser } = await import('../helpers/factories/index.js'));
    ({ adminRestaurantManagementService } = await import(
      '../../src/services/adminRestaurantManagementService.js'
    ));
    imageService = await import('../../src/services/restaurantImageService.js');
    storageService = await import('../../src/services/s3RestaurantImageStorageService.js');
  });

  beforeEach(() => {
    storageService.setS3RestaurantImageClientForTests({
      send: vi.fn(async () => ({})),
    });
    storageService.setRestaurantImageSignerForTests(
      vi.fn(async (_client, command) => `https://signed.test/${command.input.Key}`),
    );
  });

  afterEach(() => {
    storageService.resetRestaurantImageSignerForTests();
    storageService.resetS3RestaurantImageClientForTests();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    if (originalBucket === undefined) delete process.env.AWS_RESTAURANT_IMAGES_BUCKET_NAME;
    else process.env.AWS_RESTAURANT_IMAGES_BUCKET_NAME = originalBucket;
    await closeDbPool();
  });

  it('lists draft restaurants and returns an editable detail to ADMIN', async () => {
    const actor = await createUser({ displayName: 'Restaurant Admin' });
    const restaurant = await createRestaurant({
      name: 'Draft Admin Restaurant',
      status: 'DRAFT',
    });

    try {
      const list = await adminRestaurantManagementService.listRestaurants(
        { id: actor.id, roles: ['ADMIN'] },
        { status: 'DRAFT', keyword: 'Draft Admin' },
      );
      expect(list.items).toEqual([
        expect.objectContaining({
          id: restaurant.id,
          name: 'Draft Admin Restaurant',
          status: 'DRAFT',
        }),
      ]);

      const detail = await adminRestaurantManagementService.getRestaurant(
        { id: actor.id, roles: ['ADMIN'] },
        restaurant.id,
      );
      expect(detail).toMatchObject({
        id: restaurant.id,
        status: 'DRAFT',
        images: [],
      });
      expect(Array.isArray(detail.availableCategories)).toBe(true);
    } finally {
      await cleanup({ userIds: [actor.id], restaurantIds: [restaurant.id] });
    }
  });

  it('updates the complete profile and writes an audit record in the transaction', async () => {
    const actor = await createUser({ displayName: 'Profile Admin' });
    const restaurant = await createRestaurant({
      name: 'Before Admin Update',
      status: 'DRAFT',
    });

    try {
      const updated = await adminRestaurantManagementService.updateRestaurant(
        { id: actor.id, roles: ['SUPER_ADMIN'] },
        restaurant.id,
        {
          name: 'After Admin Update',
          description: 'Updated description',
          address: '456 Updated Street',
          phoneNumber: '+84912345678',
          latitude: 10.7769,
          longitude: 106.7009,
          status: 'ACTIVE',
          categoryIds: [],
          reason: 'Verified restaurant profile correction',
        },
      );
      expect(updated).toMatchObject({
        name: 'After Admin Update',
        description: 'Updated description',
        address: '456 Updated Street',
        phoneNumber: '+84912345678',
        status: 'ACTIVE',
      });

      const audit = await query(
        `SELECT action, previous_status, new_status, reason
         FROM audit_logs
         WHERE actor_id = $1 AND entity_id = $2`,
        [actor.id, restaurant.id],
      );
      expect(audit.rows).toEqual([
        expect.objectContaining({
          action: 'RESTAURANT_UPDATE',
          previous_status: 'DRAFT',
          new_status: 'ACTIVE',
          reason: 'Verified restaurant profile correction',
        }),
      ]);
    } finally {
      await cleanup({ userIds: [actor.id], restaurantIds: [restaurant.id] });
    }
  });

  it('uploads, changes the primary image, and removes it with deterministic promotion', async () => {
    const actor = await createUser({ displayName: 'Image Admin' });
    const restaurant = await createRestaurant({ name: 'Gallery Restaurant' });
    const context = {
      userId: actor.id,
      roles: ['ADMIN'],
      restaurantId: restaurant.id,
    };

    try {
      const first = await imageService.uploadRestaurantImage({
        ...context,
        idempotencyKey: crypto.randomUUID(),
        fields: { caption: 'First', isPrimary: 'true' },
        file: validJpeg(),
      });
      const second = await imageService.uploadRestaurantImage({
        ...context,
        idempotencyKey: crypto.randomUUID(),
        fields: { caption: 'Second', isPrimary: 'false' },
        file: validJpeg(),
      });

      await imageService.updateRestaurantImage({
        ...context,
        imageId: second.body.id,
        fields: { isPrimary: true, caption: 'Second primary' },
      });
      const beforeDelete = await imageService.listRestaurantImages(context);
      expect(beforeDelete.items.filter((image) => image.isPrimary)).toEqual([
        expect.objectContaining({ id: second.body.id, caption: 'Second primary' }),
      ]);

      const removed = await imageService.deleteRestaurantImage({
        ...context,
        imageId: second.body.id,
        idempotencyKey: crypto.randomUUID(),
      });
      expect(removed.body).toMatchObject({
        deleted: true,
        promotedPrimaryImageId: first.body.id,
      });

      const afterDelete = await imageService.listRestaurantImages(context);
      expect(afterDelete.items).toEqual([
        expect.objectContaining({ id: first.body.id, isPrimary: true }),
      ]);
    } finally {
      await cleanup({ userIds: [actor.id], restaurantIds: [restaurant.id] });
    }
  });

  it('replaces an image while preserving its primary state and caption', async () => {
    const actor = await createUser({ displayName: 'Replace Image Admin' });
    const restaurant = await createRestaurant({ name: 'Replace Gallery Restaurant' });
    const context = {
      userId: actor.id,
      roles: ['ADMIN'],
      restaurantId: restaurant.id,
    };

    try {
      const original = await imageService.uploadRestaurantImage({
        ...context,
        idempotencyKey: crypto.randomUUID(),
        fields: { caption: 'Original caption', isPrimary: 'true' },
        file: validJpeg(),
      });
      const replacement = await imageService.replaceRestaurantImage({
        ...context,
        imageId: original.body.id,
        idempotencyKey: crypto.randomUUID(),
        fields: {},
        file: validJpeg(),
      });

      expect(replacement.body).toMatchObject({
        caption: 'Original caption',
        isPrimary: true,
      });
      expect(replacement.body.id).not.toBe(original.body.id);
      const images = await imageService.listRestaurantImages(context);
      expect(images.items).toEqual([
        expect.objectContaining({
          id: replacement.body.id,
          caption: 'Original caption',
          isPrimary: true,
        }),
      ]);
    } finally {
      await cleanup({ userIds: [actor.id], restaurantIds: [restaurant.id] });
    }
  });

  it('resumes replacement cleanup with the same idempotency key after provider failure', async () => {
    const actor = await createUser({ displayName: 'Retry Replace Admin' });
    const restaurant = await createRestaurant({ name: 'Retry Replace Restaurant' });
    const context = {
      userId: actor.id,
      roles: ['ADMIN'],
      restaurantId: restaurant.id,
    };

    try {
      const original = await imageService.uploadRestaurantImage({
        ...context,
        idempotencyKey: crypto.randomUUID(),
        fields: { caption: 'Retry caption', isPrimary: 'true' },
        file: validJpeg(),
      });
      const replacementKey = crypto.randomUUID();
      let deleteAttempts = 0;
      storageService.setS3RestaurantImageClientForTests({
        send: vi.fn(async (command) => {
          if (command.constructor.name === 'DeleteObjectCommand') {
            deleteAttempts += 1;
            if (deleteAttempts === 1) throw new Error('temporary delete failure');
          }
          return {};
        }),
      });
      const replacementRequest = {
        ...context,
        imageId: original.body.id,
        idempotencyKey: replacementKey,
        fields: {},
        file: validJpeg(),
      };

      await expect(
        imageService.replaceRestaurantImage(replacementRequest),
      ).rejects.toMatchObject({
        statusCode: 503,
        code: 'PROVIDER_UNAVAILABLE',
      });
      const retry = await imageService.replaceRestaurantImage(replacementRequest);
      expect(retry).toMatchObject({
        statusCode: 200,
        replayed: true,
        body: {
          caption: 'Retry caption',
          isPrimary: true,
        },
      });
      expect(deleteAttempts).toBe(2);

      const images = await imageService.listRestaurantImages(context);
      expect(images.items).toEqual([
        expect.objectContaining({
          id: retry.body.id,
          caption: 'Retry caption',
          isPrimary: true,
        }),
      ]);

      const unrelated = await imageService.uploadRestaurantImage({
        ...context,
        idempotencyKey: crypto.randomUUID(),
        fields: { caption: 'Unrelated image', isPrimary: 'false' },
        file: validJpeg(),
      });
      await expect(imageService.replaceRestaurantImage({
        ...replacementRequest,
        imageId: unrelated.body.id,
      })).rejects.toMatchObject({
        statusCode: 409,
        code: 'IDEMPOTENCY_CONFLICT',
      });
      const unrelatedRow = await query(
        'SELECT id FROM restaurant_images WHERE id = $1',
        [unrelated.body.id],
      );
      expect(unrelatedRow.rowCount).toBe(1);
    } finally {
      await cleanup({ userIds: [actor.id], restaurantIds: [restaurant.id] });
    }
  });

  it('keeps a committed upload retryable when signed URL generation fails', async () => {
    const actor = await createUser({ displayName: 'Signing Failure Admin' });
    const restaurant = await createRestaurant({ name: 'Signing Failure Restaurant' });
    const idempotencyKey = crypto.randomUUID();
    const request = {
      userId: actor.id,
      roles: ['ADMIN'],
      restaurantId: restaurant.id,
      idempotencyKey,
      fields: { caption: 'Committed image', isPrimary: 'true' },
      file: validJpeg(),
    };
    const send = vi.fn(async () => ({}));
    storageService.setS3RestaurantImageClientForTests({ send });
    storageService.setRestaurantImageSignerForTests(
      vi.fn(async () => {
        throw new Error('signer temporarily unavailable');
      }),
    );

    try {
      await expect(imageService.uploadRestaurantImage(request)).rejects.toMatchObject({
        statusCode: 503,
        code: 'PROVIDER_UNAVAILABLE',
      });
      const committed = await query(
        'SELECT id FROM restaurant_images WHERE restaurant_id = $1',
        [restaurant.id],
      );
      expect(committed.rowCount).toBe(1);
      expect(send.mock.calls.map(([command]) => command.constructor.name)).not.toContain(
        'DeleteObjectCommand',
      );

      storageService.setRestaurantImageSignerForTests(
        vi.fn(async (_client, command) => `https://signed.test/${command.input.Key}`),
      );
      const replay = await imageService.uploadRestaurantImage(request);
      expect(replay).toMatchObject({
        statusCode: 201,
        replayed: true,
        body: {
          caption: 'Committed image',
          isPrimary: true,
        },
      });
      const afterReplay = await query(
        'SELECT id FROM restaurant_images WHERE restaurant_id = $1',
        [restaurant.id],
      );
      expect(afterReplay.rowCount).toBe(1);
    } finally {
      await cleanup({ userIds: [actor.id], restaurantIds: [restaurant.id] });
    }
  });

  it('rejects spoofed image bytes without creating database or provider residue', async () => {
    const actor = await createUser({ displayName: 'Invalid Image Admin' });
    const restaurant = await createRestaurant({ name: 'Invalid Gallery Restaurant' });
    const send = vi.fn(async () => ({}));
    storageService.setS3RestaurantImageClientForTests({ send });

    try {
      await expect(imageService.uploadRestaurantImage({
        userId: actor.id,
        roles: ['ADMIN'],
        restaurantId: restaurant.id,
        idempotencyKey: crypto.randomUUID(),
        fields: { isPrimary: 'true' },
        file: {
          ...validJpeg(),
          buffer: Buffer.from('not-an-image'),
          size: 12,
        },
      })).rejects.toMatchObject({
        statusCode: 415,
        code: 'UNSUPPORTED_FILE_TYPE',
      });

      const rows = await query(
        'SELECT id FROM restaurant_images WHERE restaurant_id = $1',
        [restaurant.id],
      );
      expect(rows.rowCount).toBe(0);
      expect(send).not.toHaveBeenCalled();
    } finally {
      await cleanup({ userIds: [actor.id], restaurantIds: [restaurant.id] });
    }
  });
});
