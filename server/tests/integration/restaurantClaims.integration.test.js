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
const originalBucketName = process.env.AWS_S3_BUCKET_NAME;
const TEST_CLAIM_BUCKET = 'trustbite-test-merchant-claims';
process.env.TRUSTBITE_TRUSTED_AUTH_HEADERS = 'true';
process.env.AWS_S3_BUCKET_NAME = TEST_CLAIM_BUCKET;

let claimStorage;
let closeDbPool;
let createRestaurant;
let createUser;
let query;
let requestApp;

const authHeaders = (userId) => ({
  'x-trustbite-user-id': userId,
});

async function assignRole(userId, roleId) {
  await query(
    `INSERT INTO roles (id, label)
     VALUES ($1, $1)
     ON CONFLICT (id) DO NOTHING`,
    [roleId],
  );
  await query(
    `INSERT INTO user_roles (user_id, role_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [userId, roleId],
  );
}

async function createMerchant(userId, status = 'PENDING_VERIFICATION') {
  await assignRole(userId, 'MERCHANT');
  const result = await query(
    `INSERT INTO merchants (user_id, business_name, status)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [userId, `Business ${userId}`, status],
  );
  return result.rows[0];
}

function validPdf() {
  return Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF');
}

describe('restaurant merchant claim API', () => {
  beforeAll(async () => {
    ({ closeDbPool, query } = await import('../helpers/db.js'));
    ({ createRestaurant, createUser } = await import('../helpers/factories/index.js'));
    ({ requestApp } = await import('../helpers/http.js'));
    claimStorage = await import('../../src/services/s3MerchantClaimStorageService.js');
  });

  let trackedUserIds = [];
  let trackedRestaurantIds = [];

  beforeEach(() => {
    trackedUserIds = [];
    trackedRestaurantIds = [];
    claimStorage.setMerchantClaimSignerForTests(
      async (_client, command) => `https://signed.test/${command.input.Key}?X-Amz-Signature=claim`,
    );
  });

  afterEach(async () => {
    claimStorage.resetS3MerchantClaimClientForTests();
    claimStorage.resetMerchantClaimSignerForTests();
    if (trackedUserIds.length > 0) {
      await query('DELETE FROM audit_logs WHERE actor_id = ANY($1::uuid[])', [trackedUserIds]);
      await query('DELETE FROM idempotency_keys WHERE user_id = ANY($1::uuid[])', [trackedUserIds]);
      await query(
        `DELETE FROM restaurant_merchants
         WHERE merchant_id IN (SELECT id FROM merchants WHERE user_id = ANY($1::uuid[]))`,
        [trackedUserIds],
      );
      await query(
        `DELETE FROM restaurant_claims
         WHERE merchant_id IN (SELECT id FROM merchants WHERE user_id = ANY($1::uuid[]))`,
        [trackedUserIds],
      );
      await query('DELETE FROM merchants WHERE user_id = ANY($1::uuid[])', [trackedUserIds]);
      await query('DELETE FROM user_roles WHERE user_id = ANY($1::uuid[])', [trackedUserIds]);
    }
    if (trackedRestaurantIds.length > 0) {
      await query('DELETE FROM restaurants WHERE id = ANY($1::uuid[])', [trackedRestaurantIds]);
    }
    if (trackedUserIds.length > 0) {
      await query('DELETE FROM users WHERE id = ANY($1::uuid[])', [trackedUserIds]);
    }
  });

  afterAll(async () => {
    try {
      if (originalTrustedAuthHeaders === undefined) {
        delete process.env.TRUSTBITE_TRUSTED_AUTH_HEADERS;
      } else {
        process.env.TRUSTBITE_TRUSTED_AUTH_HEADERS = originalTrustedAuthHeaders;
      }
      if (originalBucketName === undefined) {
        delete process.env.AWS_S3_BUCKET_NAME;
      } else {
        process.env.AWS_S3_BUCKET_NAME = originalBucketName;
      }
    } finally {
      await closeDbPool();
    }
  });

  it('uploads private ownership evidence once and returns a fresh signed URL on replay', async () => {
    const restaurant = await createRestaurant();
    const user = await createUser({ displayName: 'Claiming Manager' });
    trackedRestaurantIds.push(restaurant.id);
    trackedUserIds.push(user.id);
    const merchant = await createMerchant(user.id);
    const send = vi.fn(async () => ({}));
    claimStorage.setS3MerchantClaimClientForTests({ send });
    const idempotencyKey = crypto.randomUUID();

    const submit = () => requestApp()
      .post('/api/v1/merchant/restaurant-claims')
      .set(authHeaders(user.id))
      .set('Idempotency-Key', idempotencyKey)
      .field('restaurantId', restaurant.id)
      .field('requestedPermissionLevel', 'MANAGER')
      .attach('evidenceFile', validPdf(), 'business-license.pdf');

    const first = await submit().expect(201);
    expect(first.body).toMatchObject({
      merchantId: merchant.id,
      restaurantId: restaurant.id,
      requestedPermissionLevel: 'MANAGER',
      status: 'SUBMITTED',
    });
    expect(first.body.evidenceUrl).toContain('X-Amz-Signature=claim');

    const replay = await submit().expect(201);
    expect(replay.headers['idempotency-replayed']).toBe('true');
    expect(replay.body.evidenceUrl).toContain('X-Amz-Signature=claim');
    expect(send.mock.calls.filter(([command]) => command.constructor.name === 'PutObjectCommand')).toHaveLength(1);

    await requestApp()
      .post('/api/v1/merchant/restaurant-claims')
      .set(authHeaders(user.id))
      .set('Idempotency-Key', crypto.randomUUID())
      .field('restaurantId', restaurant.id)
      .field('requestedPermissionLevel', 'MANAGER')
      .attach('evidenceFile', validPdf(), 'duplicate-license.pdf')
      .expect(409);
    expect(send.mock.calls.filter(([command]) => command.constructor.name === 'PutObjectCommand')).toHaveLength(1);

    const stored = await query(
      `SELECT evidence_url, requested_permission_level
       FROM restaurant_claims
       WHERE id = $1`,
      [first.body.id],
    );
    expect(stored.rows[0].evidence_url).toMatch(/^s3:\/\/.+\/receipts\/merchant-claims\//);
    expect(stored.rows[0].requested_permission_level).toBe('MANAGER');

    const ownClaims = await requestApp()
      .get('/api/v1/merchant/restaurant-claims')
      .set(authHeaders(user.id))
      .expect(200);
    expect(ownClaims.body.items).toHaveLength(1);
    expect(ownClaims.body.items[0].evidenceUrl).toContain('X-Amz-Signature=claim');
  });

  it('rejects non-merchants and invalid evidence before S3 access', async () => {
    const restaurant = await createRestaurant();
    const user = await createUser({ displayName: 'Not a Merchant' });
    trackedRestaurantIds.push(restaurant.id);
    trackedUserIds.push(user.id);
    const send = vi.fn(async () => ({}));
    claimStorage.setS3MerchantClaimClientForTests({ send });

    await requestApp()
      .post('/api/v1/merchant/restaurant-claims')
      .set(authHeaders(user.id))
      .set('Idempotency-Key', crypto.randomUUID())
      .field('restaurantId', restaurant.id)
      .field('requestedPermissionLevel', 'OWNER')
      .attach('evidenceFile', validPdf(), 'ownership.pdf')
      .expect(403);

    await assignRole(user.id, 'MERCHANT');
    await createMerchant(user.id);
    await requestApp()
      .post('/api/v1/merchant/restaurant-claims')
      .set(authHeaders(user.id))
      .set('Idempotency-Key', crypto.randomUUID())
      .field('restaurantId', restaurant.id)
      .field('requestedPermissionLevel', 'OWNER')
      .attach('evidenceFile', Buffer.from('not a document'), 'ownership.pdf')
      .expect(422);

    expect(send).not.toHaveBeenCalled();
  });

  it('lets an admin review and approve a claim into an active manager assignment', async () => {
    const restaurant = await createRestaurant({ status: 'DRAFT' });
    const merchantUser = await createUser({ displayName: 'Pending Restaurant Manager' });
    const admin = await createUser({ displayName: 'Claims Admin' });
    trackedRestaurantIds.push(restaurant.id);
    trackedUserIds.push(merchantUser.id, admin.id);
    const merchant = await createMerchant(merchantUser.id);
    await assignRole(admin.id, 'ADMIN');
    const claim = await query(
      `INSERT INTO restaurant_claims (
         merchant_id,
         restaurant_id,
         status,
         evidence_url,
         requested_permission_level
       )
       VALUES ($1, $2, 'SUBMITTED', $3, 'MANAGER')
       RETURNING id`,
      [
        merchant.id,
        restaurant.id,
        `s3://${TEST_CLAIM_BUCKET}/receipts/merchant-claims/${merchant.id}/${restaurant.id}/${crypto.randomUUID()}.pdf`,
      ],
    );

    const queue = await requestApp()
      .get('/api/v1/admin/restaurant-claims?status=SUBMITTED&page=1&pageSize=1')
      .set(authHeaders(admin.id))
      .expect(200);
    expect(queue.body.items).toHaveLength(1);
    expect(queue.body).toMatchObject({
      page: 1,
      pageSize: 1,
      total: 1,
    });
    expect(queue.body.items[0].evidenceUrl).toContain('X-Amz-Signature=claim');

    await requestApp()
      .get('/api/v1/admin/restaurant-claims?pageSize=51')
      .set(authHeaders(admin.id))
      .expect(422);

    const adminRestaurants = await requestApp()
      .get('/api/v1/admin/restaurants?page=1&pageSize=20')
      .set(authHeaders(admin.id))
      .query({ keyword: restaurant.name })
      .expect(200);
    expect(adminRestaurants.body.items).toEqual([
      expect.objectContaining({
        id: restaurant.id,
        status: 'DRAFT',
      }),
    ]);

    const decision = await requestApp()
      .post(`/api/v1/admin/restaurant-claims/${claim.rows[0].id}/decision`)
      .set(authHeaders(admin.id))
      .send({
        decision: 'APPROVED',
        adminNote: 'Business registration verified.',
      })
      .expect(200);
    expect(decision.body.status).toBe('APPROVED');

    const assignment = await query(
      `SELECT m.status AS merchant_status, rm.permission_level, rm.status
       FROM merchants m
       JOIN restaurant_merchants rm ON rm.merchant_id = m.id
       WHERE m.id = $1
         AND rm.restaurant_id = $2`,
      [merchant.id, restaurant.id],
    );
    expect(assignment.rows[0]).toEqual({
      merchant_status: 'ACTIVE',
      permission_level: 'MANAGER',
      status: 'ACTIVE',
    });

    const profile = await requestApp()
      .get('/api/v1/users/me')
      .set(authHeaders(merchantUser.id))
      .expect(200);
    expect(profile.body.roles).toContain('MERCHANT');

    const assignedRestaurants = await requestApp()
      .get('/api/v1/merchant/restaurants')
      .set(authHeaders(merchantUser.id))
      .expect(200);
    expect(assignedRestaurants.body.items).toEqual([
      expect.objectContaining({
        id: restaurant.id,
        permissionLevel: 'MANAGER',
      }),
    ]);

    const replay = await requestApp()
      .post(`/api/v1/admin/restaurant-claims/${claim.rows[0].id}/decision`)
      .set(authHeaders(admin.id))
      .send({
        decision: 'APPROVED',
        adminNote: 'Business registration verified.',
      })
      .expect(200);
    expect(replay.body.status).toBe('APPROVED');

    await requestApp()
      .post(`/api/v1/admin/restaurant-claims/${claim.rows[0].id}/decision`)
      .set(authHeaders(admin.id))
      .send({
        decision: 'REJECTED',
        adminNote: 'Conflicting second decision.',
      })
      .expect(409);
  });
});
