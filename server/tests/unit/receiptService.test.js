import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/db.js', () => ({
  pool: {
    connect: vi.fn(),
  },
}));

vi.mock('../../src/services/s3ReceiptStorageService.js', () => ({
  buildReceiptObjectKey: vi.fn(() => 'receipts/user/review/object.jpg'),
  uploadReceiptObject: vi.fn(() => Promise.resolve('s3://trustbite-invoices/receipts/user/review/object.jpg')),
  deleteReceiptObject: vi.fn(() => Promise.resolve()),
}));

const { pool } = await import('../../src/config/db.js');
const { uploadReceiptObject } = await import('../../src/services/s3ReceiptStorageService.js');
const { uploadReceiptForReview } = await import('../../src/services/receiptService.js');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const REVIEW_ID = '22222222-2222-4222-8222-222222222222';
const RESTAURANT_ID = '33333333-3333-4333-8333-333333333333';
const IDEMPOTENCY_KEY = '44444444-4444-4444-8444-444444444444';

const JPEG_BUFFER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

function validFile(overrides = {}) {
  return {
    originalname: 'receipt.jpg',
    mimetype: 'image/jpeg',
    size: JPEG_BUFFER.length,
    buffer: JPEG_BUFFER,
    ...overrides,
  };
}

function validFields(overrides = {}) {
  return {
    reviewId: REVIEW_ID,
    restaurantId: RESTAURANT_ID,
    ...overrides,
  };
}

function createClient() {
  return {
    query: vi.fn(),
    release: vi.fn(),
  };
}

function mockReceiptHappyPath(client) {
  client.query
    .mockResolvedValueOnce({}) // BEGIN
    .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // idempotency lookup
    .mockResolvedValueOnce({}) // create idempotency
    .mockResolvedValueOnce({
      rows: [{
        id: REVIEW_ID,
        user_id: USER_ID,
        restaurant_id: RESTAURANT_ID,
        branch_id: null,
        status: 'SUBMITTED',
        verification_status: 'UNVERIFIED',
        restaurant_status: 'ACTIVE',
        restaurant_is_deleted: false,
      }],
      rowCount: 1,
    })
    .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // active receipt check
    .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // duplicate hash check
    .mockResolvedValueOnce({ rows: [{ id: '55555555-5555-4555-8555-555555555555', status: 'UPLOADED' }], rowCount: 1 })
    .mockResolvedValueOnce({}) // update review
    .mockResolvedValueOnce({}) // idempotency completed
    .mockResolvedValueOnce({}); // COMMIT
}

describe('uploadReceiptForReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires an idempotency key before opening a transaction', async () => {
    await expect(uploadReceiptForReview({
      userId: USER_ID,
      idempotencyKey: undefined,
      fields: validFields(),
      file: validFile(),
    })).rejects.toMatchObject({ statusCode: 400, code: 'IDEMPOTENCY_KEY_REQUIRED' });

    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('rejects unsupported file types before opening a transaction', async () => {
    await expect(uploadReceiptForReview({
      userId: USER_ID,
      idempotencyKey: IDEMPOTENCY_KEY,
      fields: validFields(),
      file: validFile({ originalname: 'receipt.gif', mimetype: 'image/gif', buffer: Buffer.from('gif'), size: 3 }),
    })).rejects.toMatchObject({ statusCode: 415, code: 'UNSUPPORTED_FILE_TYPE' });

    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('uploads a receipt, records it, and returns a 202 response body', async () => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    mockReceiptHappyPath(client);

    const result = await uploadReceiptForReview({
      userId: USER_ID,
      idempotencyKey: IDEMPOTENCY_KEY,
      fields: validFields(),
      file: validFile(),
    });

    expect(uploadReceiptObject).toHaveBeenCalledWith(expect.objectContaining({
      key: 'receipts/user/review/object.jpg',
      body: JPEG_BUFFER,
      contentType: 'image/jpeg',
    }));
    expect(result).toEqual({
      statusCode: 202,
      body: {
        receiptVerificationId: '55555555-5555-4555-8555-555555555555',
        status: 'UPLOADED',
        processingStatus: 'HASH_CHECKING',
      },
    });
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
  });

  it('replays a completed idempotent response for the same payload', async () => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    const body = {
      receiptVerificationId: '55555555-5555-4555-8555-555555555555',
      status: 'UPLOADED',
      processingStatus: 'HASH_CHECKING',
    };

    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [{
          request_hash: 'placeholder',
          status: 'COMPLETED',
          response_status_code: 202,
          response_body: body,
        }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({});

    // Use the generated request hash from a first call by letting the service see a matching row.
    // The row hash is patched after validation by intercepting the query result in-place.
    const originalQuery = client.query;
    client.query = vi.fn(async (...args) => {
      const result = await originalQuery(...args);
      if (args[0].includes('SELECT *') && result.rows[0]) {
        const crypto = await import('node:crypto');
        const fileHash = crypto.createHash('sha256').update(JPEG_BUFFER).digest('hex');
        result.rows[0].request_hash = crypto.createHash('sha256').update(JSON.stringify({
          userId: USER_ID,
          endpoint: 'POST /api/v1/receipts',
          reviewId: REVIEW_ID,
          restaurantId: RESTAURANT_ID,
          latitude: null,
          longitude: null,
          gpsAccuracyMeters: null,
          capturedAt: null,
          fileHash,
        })).digest('hex');
      }
      return result;
    });

    const result = await uploadReceiptForReview({
      userId: USER_ID,
      idempotencyKey: IDEMPOTENCY_KEY,
      fields: validFields(),
      file: validFile(),
    });

    expect(result).toEqual({ statusCode: 202, body, replayed: true });
    expect(uploadReceiptObject).not.toHaveBeenCalled();
  });
});
