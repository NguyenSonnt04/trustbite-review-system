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
const originalBucket = process.env.AWS_S3_BUCKET_NAME;
const originalModelId = process.env.AWS_BEDROCK_MODEL_ID;

process.env.TRUSTBITE_TRUSTED_AUTH_HEADERS = 'true';
process.env.AWS_S3_BUCKET_NAME = 'trustbite-test-bill-scans';
process.env.AWS_BEDROCK_MODEL_ID = 'google.gemma-test';

let closeDbPool;
let createRestaurant;
let createUser;
let query;
let requestApp;
let storageService;
let textractProvider;
let bedrockProvider;
let s3Send;

const createdUserIds = [];
const createdRestaurantIds = [];

const authHeaders = (userId) => ({ 'x-trustbite-user-id': userId });
const jpeg = () => Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
  0x49, 0x46, 0x00, 0x01, 0xff, 0xd9,
]);

function billRequestHash({ userId, restaurantId, branchId, file }) {
  const fileHash = crypto.createHash('sha256').update(file).digest('hex');
  return crypto.createHash('sha256').update(JSON.stringify({
    userId,
    restaurantId,
    branchId,
    fileHash,
  })).digest('hex');
}

async function user() {
  const row = await createUser();
  createdUserIds.push(row.id);
  return row;
}

async function restaurant() {
  const row = await createRestaurant();
  createdRestaurantIds.push(row.id);
  return row;
}

async function branch(restaurantId, { status = 'ACTIVE', name = 'District 1' } = {}) {
  const result = await query(
    `INSERT INTO restaurant_branches (
       parent_restaurant_id,
       name,
       address,
       latitude,
       longitude,
       geo,
       status
     )
     VALUES ($1, $2, '1 Test Street', 10.77, 106.69,
             ST_SetSRID(ST_MakePoint(106.69, 10.77), 4326)::geography, $3)
     RETURNING *`,
    [restaurantId, name, status],
  );
  return result.rows[0];
}

async function menuItem(restaurantId, branchId, {
  name = 'Pho bo',
  price = 50_000,
  available = true,
} = {}) {
  const item = await query(
    `INSERT INTO menu_items (restaurant_id, name, price_default, currency, status)
     VALUES ($1, $2, $3, 'VND', 'ACTIVE')
     RETURNING id, name`,
    [restaurantId, name, price],
  );
  await query(
    `INSERT INTO branch_menu_items (branch_id, menu_item_id, price, is_available)
     VALUES ($1, $2, $3, $4)`,
    [branchId, item.rows[0].id, price, available],
  );
  return { ...item.rows[0], price };
}

async function cleanup() {
  if (createdUserIds.length > 0) {
    await query('DELETE FROM bill_scans WHERE user_id = ANY($1::uuid[])', [createdUserIds]);
  }
  if (createdRestaurantIds.length > 0) {
    await query('DELETE FROM restaurants WHERE id = ANY($1::uuid[])', [createdRestaurantIds]);
  }
  if (createdUserIds.length > 0) {
    await query('DELETE FROM users WHERE id = ANY($1::uuid[])', [createdUserIds]);
  }
  createdUserIds.length = 0;
  createdRestaurantIds.length = 0;
}

function restoreEnv() {
  const restore = (key, value) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  };
  restore('TRUSTBITE_TRUSTED_AUTH_HEADERS', originalTrustedAuthHeaders);
  restore('AWS_S3_BUCKET_NAME', originalBucket);
  restore('AWS_BEDROCK_MODEL_ID', originalModelId);
}

describe('bill scan API', () => {
  beforeAll(async () => {
    ({ closeDbPool, query } = await import('../helpers/db.js'));
    ({ createRestaurant, createUser } = await import('../helpers/factories/index.js'));
    ({ requestApp } = await import('../helpers/http.js'));
    storageService = await import('../../src/services/s3BillScanStorageService.js');
    textractProvider = await import('../../src/services/providers/textractProvider.js');
    bedrockProvider = await import('../../src/services/providers/bedrockGemmaProvider.js');
  });

  beforeEach(() => {
    s3Send = vi.fn(async () => ({}));
    storageService.setS3BillScanClientForTests({
      send: s3Send,
    });
  });

  afterEach(async () => {
    await cleanup();
    storageService.resetS3BillScanClientForTests();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    restoreEnv();
    await closeDbPool();
  });

  it('lists only active branches for an active restaurant', async () => {
    const rest = await restaurant();
    const active = await branch(rest.id, { name: 'Active branch' });
    await branch(rest.id, { name: 'Inactive branch', status: 'INACTIVE' });

    const response = await requestApp()
      .get(`/api/v1/restaurants/${rest.id}/branches`)
      .expect(200);

    expect(response.body).toEqual({
      items: [{
        id: active.id,
        restaurantId: rest.id,
        name: 'Active branch',
        address: '1 Test Street',
        area: null,
        latitude: 10.77,
        longitude: 106.69,
      }],
    });
  });

  it('requires auth and rejects a branch from another restaurant', async () => {
    const owner = await user();
    const selectedRestaurant = await restaurant();
    const otherRestaurant = await restaurant();
    const selectedBranch = await branch(selectedRestaurant.id);
    const otherBranch = await branch(otherRestaurant.id);
    await menuItem(selectedRestaurant.id, selectedBranch.id);
    await menuItem(otherRestaurant.id, otherBranch.id);

    await requestApp()
      .post('/api/v1/bill-scans')
      .set('Idempotency-Key', crypto.randomUUID())
      .field('restaurantId', selectedRestaurant.id)
      .field('branchId', selectedBranch.id)
      .attach('receiptImage', jpeg(), 'bill.jpg')
      .expect(401);

    await requestApp()
      .post('/api/v1/bill-scans')
      .set(authHeaders(owner.id))
      .set('Idempotency-Key', crypto.randomUUID())
      .field('restaurantId', selectedRestaurant.id)
      .field('branchId', otherBranch.id)
      .attach('receiptImage', jpeg(), 'bill.jpg')
      .expect(422);
  });

  it('rejects files whose extension, MIME type, or magic bytes are not JPG/PNG', async () => {
    const owner = await user();
    const rest = await restaurant();
    const selectedBranch = await branch(rest.id);
    await menuItem(rest.id, selectedBranch.id);

    await requestApp()
      .post('/api/v1/bill-scans')
      .set(authHeaders(owner.id))
      .set('Idempotency-Key', crypto.randomUUID())
      .field('restaurantId', rest.id)
      .field('branchId', selectedBranch.id)
      .attach('receiptImage', Buffer.from('not an image'), {
        filename: 'bill.jpg',
        contentType: 'image/jpeg',
      })
      .expect(415);

    await requestApp()
      .post('/api/v1/bill-scans')
      .set(authHeaders(owner.id))
      .set('Idempotency-Key', crypto.randomUUID())
      .field('restaurantId', rest.id)
      .field('branchId', selectedBranch.id)
      .attach('receiptImage', jpeg(), {
        filename: 'bill.png',
        contentType: 'image/jpeg',
      })
      .expect(415);
  });

  it('computes 1000 vs 1001 VND, redacts private fields, and enforces owner reads', async () => {
    const owner = await user();
    const stranger = await user();
    const rest = await restaurant();
    const selectedBranch = await branch(rest.id);
    const pho = await menuItem(rest.id, selectedBranch.id, { name: 'Pho bo', price: 50_000 });
    const bun = await menuItem(rest.id, selectedBranch.id, { name: 'Bun bo', price: 40_000 });
    vi.spyOn(textractProvider.textractOcrProvider, 'analyzeExpense').mockResolvedValue({
      lineItems: [
        { name: 'Pho bo', quantity: 1, unitPrice: 51_000, totalPrice: 51_000 },
        { name: 'Bun bo', quantity: 1, unitPrice: 41_001, totalPrice: 41_001 },
        { name: 'Unknown', quantity: 1, unitPrice: 10_000, totalPrice: 10_000 },
      ],
    });
    vi.spyOn(bedrockProvider.bedrockGemmaProvider, 'mapNames').mockResolvedValue([
      { lineIndex: 0, menuItemId: pho.id, confidence: 0.99 },
      { lineIndex: 1, menuItemId: bun.id, confidence: 0.97 },
      { lineIndex: 2, menuItemId: null, confidence: 0.1 },
    ]);

    const response = await requestApp()
      .post('/api/v1/bill-scans')
      .set(authHeaders(owner.id))
      .set('Idempotency-Key', crypto.randomUUID())
      .field('restaurantId', rest.id)
      .field('branchId', selectedBranch.id)
      .attach('receiptImage', jpeg(), 'bill.jpg')
      .expect(201);

    expect(response.body.overallResult).toBe('PRICE_MISMATCH');
    expect(response.body.items.map((item) => item.result)).toEqual([
      'MATCHED',
      'PRICE_MISMATCH',
      'INCONCLUSIVE',
    ]);
    expect(response.body.items.map((item) => item.priceDifference)).toEqual([1000, 1001, null]);
    const serialized = JSON.stringify(response.body);
    for (const privateField of [
      'userId',
      'fileUrl',
      'fileHash',
      'provider',
      'prompt',
      'requestHash',
    ]) {
      expect(serialized).not.toContain(privateField);
    }

    await requestApp()
      .get(`/api/v1/bill-scans/${response.body.id}`)
      .set(authHeaders(stranger.id))
      .expect(404);

    const ownerRead = await requestApp()
      .get(`/api/v1/bill-scans/${response.body.id}`)
      .set(authHeaders(owner.id))
      .expect(200);
    expect(ownerRead.body).toEqual(response.body);
  });

  it('replays the same body and conflicts when the payload changes', async () => {
    const owner = await user();
    const rest = await restaurant();
    const selectedBranch = await branch(rest.id);
    const otherBranch = await branch(rest.id, { name: 'Other branch' });
    const item = await menuItem(rest.id, selectedBranch.id);
    await menuItem(rest.id, otherBranch.id);
    vi.spyOn(textractProvider.textractOcrProvider, 'analyzeExpense').mockResolvedValue({
      lineItems: [{ name: 'Pho bo', quantity: 1, unitPrice: 50_000, totalPrice: 50_000 }],
    });
    const mapping = vi.spyOn(bedrockProvider.bedrockGemmaProvider, 'mapNames').mockResolvedValue([
      { lineIndex: 0, menuItemId: item.id, confidence: 1 },
    ]);
    const idempotencyKey = crypto.randomUUID();
    const upload = (branchId = selectedBranch.id) => requestApp()
      .post('/api/v1/bill-scans')
      .set(authHeaders(owner.id))
      .set('Idempotency-Key', idempotencyKey)
      .field('restaurantId', rest.id)
      .field('branchId', branchId)
      .attach('receiptImage', jpeg(), 'bill.jpg');

    const first = await upload().expect(201);
    const replay = await upload().expect(201);
    expect(replay.headers['idempotency-replayed']).toBe('true');
    expect(replay.body).toEqual(first.body);
    expect(mapping).toHaveBeenCalledTimes(1);
    await upload(otherBranch.id).expect(409);
  });

  it('rejects takeover while a processing lease is active', async () => {
    const owner = await user();
    const rest = await restaurant();
    const selectedBranch = await branch(rest.id);
    await menuItem(rest.id, selectedBranch.id);
    const idempotencyKey = crypto.randomUUID();
    const image = jpeg();

    await query(
      `INSERT INTO bill_scans (
         user_id, restaurant_id, branch_id, idempotency_key, request_hash,
         file_url, file_hash_sha256, mime_type, file_size_bytes, status,
         processing_attempt_token, processing_lease_expires_at
       )
       VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, 'image/jpeg', $8, 'PROCESSING',
         $9, NOW() + interval '5 minutes'
       )`,
      [
        owner.id,
        rest.id,
        selectedBranch.id,
        idempotencyKey,
        billRequestHash({
          userId: owner.id,
          restaurantId: rest.id,
          branchId: selectedBranch.id,
          file: image,
        }),
        `s3://trustbite-test-bill-scans/bill-scans/${owner.id}/active/old.jpg`,
        crypto.createHash('sha256').update(image).digest('hex'),
        image.length,
        crypto.randomUUID(),
      ],
    );

    await requestApp()
      .post('/api/v1/bill-scans')
      .set(authHeaders(owner.id))
      .set('Idempotency-Key', idempotencyKey)
      .field('restaurantId', rest.id)
      .field('branchId', selectedBranch.id)
      .attach('receiptImage', image, 'bill.jpg')
      .expect(409);

    expect(s3Send).not.toHaveBeenCalled();
  });

  it('takes over a stale lease, cleans the old object, and blocks the old attempt from overwriting', async () => {
    const owner = await user();
    const rest = await restaurant();
    const selectedBranch = await branch(rest.id);
    const item = await menuItem(rest.id, selectedBranch.id);
    const idempotencyKey = crypto.randomUUID();
    let resolveFirstOcr;
    let markFirstOcrStarted;
    const firstOcrStarted = new Promise((resolve) => {
      markFirstOcrStarted = resolve;
    });
    const firstOcr = new Promise((resolve) => {
      resolveFirstOcr = resolve;
    });
    vi.spyOn(textractProvider.textractOcrProvider, 'analyzeExpense')
      .mockImplementationOnce(async () => {
        markFirstOcrStarted();
        return firstOcr;
      })
      .mockResolvedValueOnce({
        lineItems: [{
          name: 'Pho bo',
          quantity: 1,
          unitPrice: 50_000,
          totalPrice: 50_000,
        }],
      });
    vi.spyOn(bedrockProvider.bedrockGemmaProvider, 'mapNames').mockResolvedValue([
      { lineIndex: 0, menuItemId: item.id, confidence: 1 },
    ]);
    const upload = () => requestApp()
      .post('/api/v1/bill-scans')
      .set(authHeaders(owner.id))
      .set('Idempotency-Key', idempotencyKey)
      .field('restaurantId', rest.id)
      .field('branchId', selectedBranch.id)
      .attach('receiptImage', jpeg(), 'bill.jpg');

    const firstRequest = upload().then(
      (response) => response,
      (error) => error.response,
    );
    await firstOcrStarted;
    const stale = await query(
      `UPDATE bill_scans
       SET processing_lease_expires_at = NOW() - interval '1 second'
       WHERE user_id = $1
         AND idempotency_key = $2
       RETURNING id, file_url`,
      [owner.id, idempotencyKey],
    );

    const takeover = await upload().expect(201);
    expect(takeover.body.overallResult).toBe('MATCHED');
    expect(s3Send.mock.calls.map(([command]) => command.constructor.name)).toEqual([
      'PutObjectCommand',
      'DeleteObjectCommand',
      'PutObjectCommand',
    ]);
    expect(s3Send.mock.calls[1][0].input.Key).toBe(
      stale.rows[0].file_url.replace('s3://trustbite-test-bill-scans/', ''),
    );

    resolveFirstOcr({
      lineItems: [{
        name: 'Pho bo',
        quantity: 1,
        unitPrice: 99_000,
        totalPrice: 99_000,
      }],
    });
    const superseded = await firstRequest;
    expect(superseded.status).toBe(409);
    expect(superseded.body.error.code).toBe('BILL_SCAN_ATTEMPT_SUPERSEDED');

    const persisted = await query(
      `SELECT status, overall_result, processing_attempt_token, processing_lease_expires_at
       FROM bill_scans
       WHERE id = $1`,
      [stale.rows[0].id],
    );
    const persistedItems = await query(
      `SELECT observed_unit_price, result
       FROM bill_scan_line_items
       WHERE bill_scan_id = $1`,
      [stale.rows[0].id],
    );
    expect(persisted.rows[0]).toMatchObject({
      status: 'COMPLETED',
      overall_result: 'MATCHED',
      processing_attempt_token: null,
      processing_lease_expires_at: null,
    });
    expect(persistedItems.rows).toEqual([{
      observed_unit_price: '50000.00',
      result: 'MATCHED',
    }]);
  });

  it('persists FAILED after provider failure without exposing private data', async () => {
    const owner = await user();
    const rest = await restaurant();
    const selectedBranch = await branch(rest.id);
    await menuItem(rest.id, selectedBranch.id);
    vi.spyOn(textractProvider.textractOcrProvider, 'analyzeExpense')
      .mockRejectedValue(new Error('raw Textract credential detail'));
    const idempotencyKey = crypto.randomUUID();

    const failure = await requestApp()
      .post('/api/v1/bill-scans')
      .set(authHeaders(owner.id))
      .set('Idempotency-Key', idempotencyKey)
      .field('restaurantId', rest.id)
      .field('branchId', selectedBranch.id)
      .attach('receiptImage', jpeg(), 'bill.jpg')
      .expect(503);
    expect(failure.body).toEqual({
      error: {
        code: 'BILL_SCAN_PROVIDER_FAILED',
        message: 'Bill scan processing failed.',
      },
    });
    expect(JSON.stringify(failure.body)).not.toContain('credential');

    const persisted = await query(
      `SELECT id, status, provider_error_code, file_url, file_hash_sha256
       FROM bill_scans
       WHERE user_id = $1
         AND idempotency_key = $2`,
      [owner.id, idempotencyKey],
    );
    expect(persisted.rows[0]).toMatchObject({
      status: 'FAILED',
      provider_error_code: 'BILL_SCAN_PROVIDER_FAILED',
    });

    const ownerRead = await requestApp()
      .get(`/api/v1/bill-scans/${persisted.rows[0].id}`)
      .set(authHeaders(owner.id))
      .expect(200);
    expect(ownerRead.body).toMatchObject({
      id: persisted.rows[0].id,
      status: 'FAILED',
      overallResult: null,
      items: [],
    });
    expect(JSON.stringify(ownerRead.body)).not.toContain(persisted.rows[0].file_url);
    expect(JSON.stringify(ownerRead.body)).not.toContain(persisted.rows[0].file_hash_sha256);
  });
});
