import { beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_RECEIPT_FILE_URL = vi.hoisted(() => 'mock-receipt-file-url');

vi.mock('../../src/config/db.js', () => ({
  pool: {
    connect: vi.fn(),
  },
}));

vi.mock('../../src/services/s3ReceiptStorageService.js', () => ({
  buildReceiptObjectKey: vi.fn(() => 'receipts/user/review/object.jpg'),
  uploadReceiptObject: vi.fn(() => Promise.resolve(TEST_RECEIPT_FILE_URL)),
  deleteReceiptObject: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../src/services/queue/receiptOcrQueue.js', () => ({
  enqueueReceiptOcr: vi.fn(() => Promise.resolve({ id: 'receipt-ocr-job-1' })),
}));

const { pool } = await import('../../src/config/db.js');
const { deleteReceiptObject, uploadReceiptObject } = await import('../../src/services/s3ReceiptStorageService.js');
const { enqueueReceiptOcr } = await import('../../src/services/queue/receiptOcrQueue.js');
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

function reviewRow() {
  return {
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
  };
}

function mockReceiptHappyPath(client) {
  client.query
    .mockResolvedValueOnce({}) // preflight BEGIN
    .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // idempotency lookup
    .mockResolvedValueOnce({}) // create idempotency
    .mockResolvedValueOnce(reviewRow()) // preflight review lock
    .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // preflight active receipt check
    .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // preflight duplicate hash check
    .mockResolvedValueOnce({}) // preflight COMMIT
    .mockResolvedValueOnce({}) // persist BEGIN
    .mockResolvedValueOnce(reviewRow()) // persist review lock
    .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // persist active receipt check
    .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // persist duplicate hash check
    .mockResolvedValueOnce({ rows: [{ id: '55555555-5555-4555-8555-555555555555', status: 'UPLOADED' }], rowCount: 1 })
    .mockResolvedValueOnce({}) // update review
    .mockResolvedValueOnce({}) // idempotency completed
    .mockResolvedValueOnce({}); // persist COMMIT
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

  it('rejects future capturedAt before opening a transaction', async () => {
    await expect(uploadReceiptForReview({
      userId: USER_ID,
      idempotencyKey: IDEMPOTENCY_KEY,
      fields: validFields({ capturedAt: new Date(Date.now() + 60_000).toISOString() }),
      file: validFile(),
    })).rejects.toMatchObject({ statusCode: 422, code: 'VALIDATION_ERROR' });

    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('rejects capturedAt older than 48 hours before opening a transaction', async () => {
    await expect(uploadReceiptForReview({
      userId: USER_ID,
      idempotencyKey: IDEMPOTENCY_KEY,
      fields: validFields({ capturedAt: new Date(Date.now() - (49 * 60 * 60 * 1000)).toISOString() }),
      file: validFile(),
    })).rejects.toMatchObject({ statusCode: 422, code: 'VALIDATION_ERROR' });

    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('uploads a receipt, records capturedAt, enqueues OCR, and returns a 202 response body', async () => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    mockReceiptHappyPath(client);

    const capturedAt = new Date(Date.now() - 60_000).toISOString();
    const result = await uploadReceiptForReview({
      userId: USER_ID,
      idempotencyKey: IDEMPOTENCY_KEY,
      fields: validFields({ capturedAt }),
      file: validFile(),
    });

    expect(uploadReceiptObject).toHaveBeenCalledWith(expect.objectContaining({
      key: 'receipts/user/review/object.jpg',
      body: JPEG_BUFFER,
      contentType: 'image/jpeg',
    }));
    expect(client.query.mock.calls[2][0]).toContain('INSERT INTO idempotency_keys');
    expect(client.query.mock.calls[2][1]).toEqual([
      IDEMPOTENCY_KEY,
      USER_ID,
      'POST /api/v1/receipts',
      expect.any(String),
      5,
      24,
    ]);
    expect(client.query.mock.calls[11][0]).toContain('captured_at');
    expect(client.query.mock.calls[11][0]).toContain('request_ip');
    expect(client.query.mock.calls[11][1]).toEqual([
      REVIEW_ID,
      USER_ID,
      RESTAURANT_ID,
      null,
      TEST_RECEIPT_FILE_URL,
      expect.any(String),
      null,
      null,
      null,
      capturedAt,
      null,
    ]);
    expect(result).toEqual({
      statusCode: 202,
      body: {
        receiptVerificationId: '55555555-5555-4555-8555-555555555555',
        status: 'UPLOADED',
        processingStatus: 'HASH_CHECKING',
      },
    });
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
    expect(enqueueReceiptOcr).toHaveBeenCalledWith('55555555-5555-4555-8555-555555555555');
    expect(client.query.mock.invocationCallOrder.at(-1)).toBeLessThan(enqueueReceiptOcr.mock.invocationCallOrder[0]);
  });

  it('normalizes an IPv4-mapped IPv6 request IP to plain IPv4 before persisting', async () => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    mockReceiptHappyPath(client);

    await uploadReceiptForReview({
      userId: USER_ID,
      idempotencyKey: IDEMPOTENCY_KEY,
      fields: validFields(),
      file: validFile(),
      requestIp: '::ffff:203.0.113.7',
    });

    const insertParams = client.query.mock.calls[11][1];
    expect(client.query.mock.calls[11][0]).toContain('request_ip');
    expect(insertParams.at(-1)).toBe('203.0.113.7');
  });

  it('degrades the committed receipt to admin review when OCR enqueue fails after commit', async () => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    mockReceiptHappyPath(client);
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({
        rows: [{
          id: '55555555-5555-4555-8555-555555555555',
          review_id: REVIEW_ID,
          status: 'UPLOADED',
        }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ id: '55555555-5555-4555-8555-555555555555' }], rowCount: 1 })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    enqueueReceiptOcr.mockRejectedValueOnce(new Error('queue unavailable'));

    const result = await uploadReceiptForReview({
      userId: USER_ID,
      idempotencyKey: IDEMPOTENCY_KEY,
      fields: validFields(),
      file: validFile(),
    });

    expect(result).toEqual({
      statusCode: 202,
      body: {
        receiptVerificationId: '55555555-5555-4555-8555-555555555555',
        status: 'PENDING_ADMIN_REVIEW',
        processingStatus: 'PENDING_ADMIN_REVIEW',
      },
    });
    expect(enqueueReceiptOcr).toHaveBeenCalledWith('55555555-5555-4555-8555-555555555555');
    expect(client.query.mock.calls.map(([sql]) => sql)).not.toContain('ROLLBACK');
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes("SET status = 'FAILED'"))).toBe(false);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'PENDING_ADMIN_REVIEW'"),
      ['55555555-5555-4555-8555-555555555555', 'OCR enqueue failed; pending manual review.'],
    );
    expect(JSON.stringify(client.query.mock.calls)).not.toContain('queue unavailable');
    expect(deleteReceiptObject).not.toHaveBeenCalled();
  });

  it('preserves the current terminal receipt status when OCR enqueue failure degrade is skipped', async () => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    mockReceiptHappyPath(client);
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({
        rows: [{
          id: '55555555-5555-4555-8555-555555555555',
          review_id: REVIEW_ID,
          status: 'VERIFIED',
        }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    enqueueReceiptOcr.mockRejectedValueOnce(new Error('ambiguous queue timeout'));

    const result = await uploadReceiptForReview({
      userId: USER_ID,
      idempotencyKey: IDEMPOTENCY_KEY,
      fields: validFields(),
      file: validFile(),
    });

    expect(result).toEqual({
      statusCode: 202,
      body: {
        receiptVerificationId: '55555555-5555-4555-8555-555555555555',
        status: 'VERIFIED',
        processingStatus: 'VERIFIED',
      },
    });
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'PENDING_ADMIN_REVIEW'"),
      ['55555555-5555-4555-8555-555555555555', 'OCR enqueue failed; pending manual review.'],
    );
    expect(JSON.stringify(client.query.mock.calls)).not.toContain('ambiguous queue timeout');
    expect(deleteReceiptObject).not.toHaveBeenCalled();
  });

  it('creates a fraud flag and rejects when the receipt hash already exists', async () => {
    const client = createClient();
    const failureClient = createClient();
    const fraudClient = createClient();
    pool.connect
      .mockResolvedValueOnce(client)
      .mockResolvedValueOnce(failureClient)
      .mockResolvedValueOnce(fraudClient);

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
      .mockResolvedValueOnce({ rows: [{ id: '66666666-6666-4666-8666-666666666666' }], rowCount: 1 })
      .mockResolvedValueOnce({}); // ROLLBACK

    failureClient.query.mockResolvedValue({});

    fraudClient.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: '77777777-7777-4777-8777-777777777777' }], rowCount: 1 })
      .mockResolvedValueOnce({}) // fraud flag entities
      .mockResolvedValueOnce({}); // COMMIT

    await expect(uploadReceiptForReview({
      userId: USER_ID,
      idempotencyKey: IDEMPOTENCY_KEY,
      fields: validFields(),
      file: validFile(),
    })).rejects.toMatchObject({ statusCode: 409, code: 'DUPLICATE_RECEIPT_HASH' });

    expect(uploadReceiptObject).not.toHaveBeenCalled();
    expect(enqueueReceiptOcr).not.toHaveBeenCalled();
    expect(failureClient.query).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'FAILED'"),
      [USER_ID, 'POST /api/v1/receipts', IDEMPOTENCY_KEY],
    );
    expect(failureClient.release).toHaveBeenCalled();
    expect(fraudClient.query.mock.calls[1][0]).toContain('INSERT INTO fraud_flags');
    expect(fraudClient.query.mock.calls[2][1]).toEqual([
      '77777777-7777-4777-8777-777777777777',
      '66666666-6666-4666-8666-666666666666',
      USER_ID,
    ]);
    expect(fraudClient.release).toHaveBeenCalled();
  });

  it('preserves duplicate hash response when marking idempotency failed cannot connect', async () => {
    const client = createClient();
    const fraudClient = createClient();
    pool.connect
      .mockResolvedValueOnce(client)
      .mockRejectedValueOnce(new Error('pool exhausted while marking failed'))
      .mockResolvedValueOnce(fraudClient);

    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // idempotency lookup
      .mockResolvedValueOnce({}) // create idempotency
      .mockResolvedValueOnce(reviewRow())
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // active receipt check
      .mockResolvedValueOnce({ rows: [{ id: '66666666-6666-4666-8666-666666666666' }], rowCount: 1 })
      .mockResolvedValueOnce({}); // ROLLBACK

    fraudClient.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: '77777777-7777-4777-8777-777777777777' }], rowCount: 1 })
      .mockResolvedValueOnce({}) // fraud flag entities
      .mockResolvedValueOnce({}); // COMMIT

    await expect(uploadReceiptForReview({
      userId: USER_ID,
      idempotencyKey: IDEMPOTENCY_KEY,
      fields: validFields(),
      file: validFile(),
    })).rejects.toMatchObject({ statusCode: 409, code: 'DUPLICATE_RECEIPT_HASH' });

    expect(uploadReceiptObject).not.toHaveBeenCalled();
    expect(enqueueReceiptOcr).not.toHaveBeenCalled();
    expect(fraudClient.release).toHaveBeenCalled();
  });

  it('preserves duplicate hash response when fraud flag persistence fails', async () => {
    const client = createClient();
    const failureClient = createClient();
    const fraudClient = createClient();
    pool.connect
      .mockResolvedValueOnce(client)
      .mockResolvedValueOnce(failureClient)
      .mockResolvedValueOnce(fraudClient);

    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // idempotency lookup
      .mockResolvedValueOnce({}) // create idempotency
      .mockResolvedValueOnce(reviewRow())
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // active receipt check
      .mockResolvedValueOnce({ rows: [{ id: '66666666-6666-4666-8666-666666666666' }], rowCount: 1 })
      .mockResolvedValueOnce({}); // ROLLBACK

    failureClient.query.mockResolvedValue({});
    fraudClient.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockRejectedValueOnce(new Error('transient fraud flag write failure'))
      .mockResolvedValueOnce({}); // ROLLBACK

    await expect(uploadReceiptForReview({
      userId: USER_ID,
      idempotencyKey: IDEMPOTENCY_KEY,
      fields: validFields(),
      file: validFile(),
    })).rejects.toMatchObject({ statusCode: 409, code: 'DUPLICATE_RECEIPT_HASH' });

    expect(uploadReceiptObject).not.toHaveBeenCalled();
    expect(enqueueReceiptOcr).not.toHaveBeenCalled();
    expect(fraudClient.release).toHaveBeenCalled();
  });

  it('returns request in progress when a concurrent request creates the idempotency key first', async () => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);

    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // idempotency lookup
      .mockRejectedValueOnce({
        code: '23505',
        constraint: 'idempotency_keys_user_id_endpoint_idempotency_key_key',
      }) // create idempotency race
      .mockResolvedValueOnce({}); // ROLLBACK

    await expect(uploadReceiptForReview({
      userId: USER_ID,
      idempotencyKey: IDEMPOTENCY_KEY,
      fields: validFields(),
      file: validFile(),
    })).rejects.toMatchObject({ statusCode: 409, code: 'REQUEST_IN_PROGRESS' });

    expect(uploadReceiptObject).not.toHaveBeenCalled();
    expect(enqueueReceiptOcr).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(pool.connect).toHaveBeenCalledTimes(1);
  });

  it('refreshes lock and expiry when retrying a failed idempotency key', async () => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);

    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({
        rows: [{
          request_hash: 'placeholder',
          status: 'FAILED',
        }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({}) // refresh idempotency attempt
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
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // preflight active receipt check
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // preflight duplicate hash check
      .mockResolvedValueOnce({}) // preflight COMMIT
      .mockResolvedValueOnce({}) // persist BEGIN
      .mockResolvedValueOnce(reviewRow()) // persist review lock
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // persist active receipt check
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // persist duplicate hash check
      .mockResolvedValueOnce({ rows: [{ id: '55555555-5555-4555-8555-555555555555', status: 'UPLOADED' }], rowCount: 1 })
      .mockResolvedValueOnce({}) // update review
      .mockResolvedValueOnce({}) // idempotency completed
      .mockResolvedValueOnce({}); // persist COMMIT

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

    await uploadReceiptForReview({
      userId: USER_ID,
      idempotencyKey: IDEMPOTENCY_KEY,
      fields: validFields(),
      file: validFile(),
    });

    expect(client.query.mock.calls[2][0]).toContain('expires_at = NOW()');
    expect(client.query.mock.calls[2][1]).toEqual([
      USER_ID,
      'POST /api/v1/receipts',
      IDEMPOTENCY_KEY,
      expect.any(String),
      5,
      24,
    ]);
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
    expect(enqueueReceiptOcr).not.toHaveBeenCalled();
  });
});
