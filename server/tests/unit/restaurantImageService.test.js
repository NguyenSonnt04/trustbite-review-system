import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  client: {
    query: vi.fn(),
    release: vi.fn(),
  },
  buildKey: vi.fn(() => 'restaurant-images/restaurant-id/object.jpg'),
  upload: vi.fn(),
  remove: vi.fn(),
  resolve: vi.fn(async () => 'https://signed-s3.test/object.jpg?X-Amz-Signature=test'),
}));

vi.mock('../../src/config/db.js', () => ({
  pool: {
    connect: vi.fn(async () => mocks.client),
  },
}));

vi.mock('../../src/services/s3RestaurantImageStorageService.js', () => ({
  buildRestaurantImageObjectKey: mocks.buildKey,
  uploadRestaurantImageObject: mocks.upload,
  deleteRestaurantImageObject: mocks.remove,
  resolveRestaurantImageUrl: mocks.resolve,
}));

const { uploadRestaurantImage } = await import('../../src/services/restaurantImageService.js');

const validFile = {
  originalname: 'restaurant.jpg',
  mimetype: 'image/jpeg',
  size: 6,
  buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01, 0x02]),
};

const baseRequest = {
  userId: '11111111-1111-4111-8111-111111111111',
  roles: ['ADMIN'],
  restaurantId: '22222222-2222-4222-8222-222222222222',
  idempotencyKey: '33333333-3333-4333-8333-333333333333',
  fields: {},
  file: validFile,
};

describe('restaurant image service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects mismatched file content before DB or provider access', async () => {
    await expect(uploadRestaurantImage({
      ...baseRequest,
      file: {
        ...validFile,
        buffer: Buffer.from('not-a-jpeg'),
      },
    })).rejects.toMatchObject({
      statusCode: 415,
      code: 'UNSUPPORTED_FILE_TYPE',
    });

    expect(mocks.client.query).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it('rolls back and deletes the uploaded object when DB persistence fails', async () => {
    mocks.upload.mockResolvedValue({
      objectKey: 'restaurant-images/restaurant-id/object.jpg',
      imageReference: 's3://trustbite-restaurant-images/restaurant-images/restaurant-id/object.jpg',
    });
    mocks.client.query.mockImplementation(async (sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 };
      if (sql.includes('FROM restaurants')) {
        return { rows: [{ id: baseRequest.restaurantId }], rowCount: 1 };
      }
      if (sql.includes('FROM idempotency_keys')) {
        if (sql.includes('AND request_hash')) {
          return { rows: [{ id: 'attempt-id' }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('INSERT INTO idempotency_keys')) {
        return {
          rows: [{ locked_until: new Date('2026-07-14T00:05:00.000Z') }],
          rowCount: 1,
        };
      }
      if (sql.includes('INSERT INTO restaurant_images')) {
        throw new Error('database unavailable');
      }
      return { rows: [], rowCount: 1 };
    });

    await expect(uploadRestaurantImage(baseRequest)).rejects.toThrow('database unavailable');

    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(mocks.client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mocks.remove).toHaveBeenCalledWith({
      key: 'restaurant-images/restaurant-id/object.jpg',
    });
    expect(mocks.client.release).toHaveBeenCalledTimes(3);
  });

  it('does not persist an upload after its idempotency lease is superseded', async () => {
    mocks.upload.mockResolvedValue({
      objectKey: 'restaurant-images/restaurant-id/object.jpg',
      imageReference: 's3://trustbite-restaurant-images/restaurant-images/restaurant-id/object.jpg',
    });
    mocks.client.query.mockImplementation(async (sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK' || sql === 'COMMIT') {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('FROM restaurants')) {
        return { rows: [{ id: baseRequest.restaurantId }], rowCount: 1 };
      }
      if (sql.includes('FROM idempotency_keys')) {
        if (sql.includes('AND request_hash')) {
          return { rows: [], rowCount: 0 };
        }
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('INSERT INTO idempotency_keys')) {
        return {
          rows: [{ locked_until: new Date('2026-07-14T00:05:00.000Z') }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 1 };
    });

    await expect(uploadRestaurantImage(baseRequest)).rejects.toMatchObject({
      statusCode: 409,
      code: 'REQUEST_IN_PROGRESS',
    });

    expect(mocks.client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO restaurant_images'),
      expect.anything(),
    );
    expect(mocks.remove).toHaveBeenCalledWith({
      key: 'restaurant-images/restaurant-id/object.jpg',
    });
  });

  it('does not delete the object when the commit outcome is ambiguous', async () => {
    mocks.upload.mockResolvedValue({
      objectKey: 'restaurant-images/restaurant-id/object.jpg',
      imageReference: 's3://trustbite-restaurant-images/restaurant-images/restaurant-id/object.jpg',
    });
    let commitCount = 0;
    mocks.client.query.mockImplementation(async (sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 };
      if (sql === 'COMMIT') {
        commitCount += 1;
        if (commitCount === 2) throw new Error('connection lost during commit');
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('FROM restaurants')) {
        return { rows: [{ id: baseRequest.restaurantId }], rowCount: 1 };
      }
      if (sql.includes('FROM idempotency_keys')) {
        if (sql.includes('AND request_hash')) {
          return { rows: [{ id: 'attempt-id' }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('INSERT INTO idempotency_keys')) {
        return {
          rows: [{ locked_until: new Date('2026-07-14T00:05:00.000Z') }],
          rowCount: 1,
        };
      }
      if (sql.includes('INSERT INTO restaurant_images')) {
        return {
          rowCount: 1,
          rows: [{
            id: '44444444-4444-4444-8444-444444444444',
            restaurant_id: baseRequest.restaurantId,
            branch_id: null,
            image_url: 's3://trustbite-restaurant-images/restaurant-images/restaurant-id/object.jpg',
            caption: null,
            is_primary: true,
            created_at: new Date('2026-07-14T00:00:00.000Z'),
          }],
        };
      }
      return { rows: [], rowCount: 1 };
    });

    await expect(uploadRestaurantImage(baseRequest)).rejects.toThrow(
      'connection lost during commit',
    );

    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.client.release).toHaveBeenCalledTimes(2);
  });
});
