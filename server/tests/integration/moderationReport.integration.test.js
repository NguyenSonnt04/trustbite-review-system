import '../helpers/env.js';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

process.env.TRUSTBITE_TRUSTED_AUTH_HEADERS = 'true';

const { createUser, createRestaurant, createReview } = await import('../helpers/factories/index.js');
const { closeDbPool, query } = await import('../helpers/db.js');
const { requestApp } = await import('../helpers/http.js');

const authHeaders = (userId) => ({
  'x-trustbite-user-id': userId,
});

const createdUserIds = new Set();
const createdReviewIds = new Set();
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

async function newReview(args) {
  const review = await createReview(args);
  createdReviewIds.add(review.id);
  return review;
}

beforeAll(async () => {
  // Self-contained: ensure the reason codes this suite uses exist regardless of
  // whether migration 008 has been applied in this environment.
  await query(
    `INSERT INTO report_reason_codes (code, label, entity_type) VALUES
       ('SPAM_OR_FAKE', 'Spam hoặc đánh giá giả', 'REVIEW'),
       ('ABUSIVE_BEHAVIOR', 'Hành vi lạm dụng hoặc quấy rối', 'USER')
     ON CONFLICT (code) DO NOTHING`,
  );
});

describe('moderation report API', () => {
  afterEach(async () => {
    for (const id of createdUserIds) {
      await query('DELETE FROM moderation_reports WHERE reporter_id = $1', [id]);
    }
    for (const id of createdReviewIds) {
      await query('DELETE FROM reviews WHERE id = $1', [id]);
    }
    for (const id of createdRestaurantIds) {
      await query('DELETE FROM restaurants WHERE id = $1', [id]);
    }
    for (const id of createdUserIds) {
      await query('DELETE FROM users WHERE id = $1', [id]);
    }
    createdUserIds.clear();
    createdReviewIds.clear();
    createdRestaurantIds.clear();
  });

  afterAll(async () => {
    await closeDbPool();
  });

  it('creates a SUBMITTED report for a review and persists it', async () => {
    const reporter = await newUser({ displayName: 'Reporter' });
    const author = await newUser({ displayName: 'Author' });
    const restaurant = await newRestaurant();
    const review = await newReview({ userId: author.id, restaurantId: restaurant.id });

    const response = await requestApp()
      .post('/api/v1/moderation/reports')
      .set(authHeaders(reporter.id))
      .send({ entityType: 'REVIEW', entityId: review.id, reasonCode: 'SPAM_OR_FAKE', description: 'seeding' })
      .expect(201);

    expect(response.body).toMatchObject({ status: 'SUBMITTED' });
    expect(response.body.reportId).toBeTruthy();

    const persisted = await query(
      'SELECT reporter_id, entity_type, entity_id, reason_code, status FROM moderation_reports WHERE id = $1',
      [response.body.reportId],
    );
    expect(persisted.rows[0]).toMatchObject({
      reporter_id: reporter.id,
      entity_type: 'REVIEW',
      entity_id: review.id,
      reason_code: 'SPAM_OR_FAKE',
      status: 'SUBMITTED',
    });
  });

  it('creates a report against another user', async () => {
    const reporter = await newUser({ displayName: 'User Reporter' });
    const target = await newUser({ displayName: 'Reported User' });

    const response = await requestApp()
      .post('/api/v1/moderation/reports')
      .set(authHeaders(reporter.id))
      .send({ entityType: 'USER', entityId: target.id, reasonCode: 'ABUSIVE_BEHAVIOR' })
      .expect(201);

    expect(response.body).toMatchObject({ status: 'SUBMITTED' });
  });

  it('rejects a second open report for the same entity with 409', async () => {
    const reporter = await newUser({ displayName: 'Dup Reporter' });
    const target = await newUser({ displayName: 'Dup Target' });

    await requestApp()
      .post('/api/v1/moderation/reports')
      .set(authHeaders(reporter.id))
      .send({ entityType: 'USER', entityId: target.id, reasonCode: 'ABUSIVE_BEHAVIOR' })
      .expect(201);

    const response = await requestApp()
      .post('/api/v1/moderation/reports')
      .set(authHeaders(reporter.id))
      .send({ entityType: 'USER', entityId: target.id, reasonCode: 'ABUSIVE_BEHAVIOR' })
      .expect(409);

    expect(response.body.error.code).toBe('REPORT_DUPLICATE');

    const count = await query(
      'SELECT count(*)::int AS n FROM moderation_reports WHERE reporter_id = $1 AND entity_id = $2',
      [reporter.id, target.id],
    );
    expect(count.rows[0].n).toBe(1);
  });

  it('rejects an unknown reason code with 422', async () => {
    const reporter = await newUser({ displayName: 'Bad Reason Reporter' });
    const target = await newUser({ displayName: 'Bad Reason Target' });

    const response = await requestApp()
      .post('/api/v1/moderation/reports')
      .set(authHeaders(reporter.id))
      .send({ entityType: 'USER', entityId: target.id, reasonCode: 'NOT_A_REAL_CODE' })
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a reason code whose entity_type does not match', async () => {
    const reporter = await newUser({ displayName: 'Mismatch Reporter' });
    const author = await newUser({ displayName: 'Mismatch Author' });
    const restaurant = await newRestaurant();
    const review = await newReview({ userId: author.id, restaurantId: restaurant.id });

    const response = await requestApp()
      .post('/api/v1/moderation/reports')
      .set(authHeaders(reporter.id))
      .send({ entityType: 'REVIEW', entityId: review.id, reasonCode: 'ABUSIVE_BEHAVIOR' })
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects reporting your own review with 422', async () => {
    const author = await newUser({ displayName: 'Own Review Author' });
    const restaurant = await newRestaurant();
    const review = await newReview({ userId: author.id, restaurantId: restaurant.id });

    const response = await requestApp()
      .post('/api/v1/moderation/reports')
      .set(authHeaders(author.id))
      .send({ entityType: 'REVIEW', entityId: review.id, reasonCode: 'SPAM_OR_FAKE' })
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a report against a non-existent entity with 422', async () => {
    const reporter = await newUser({ displayName: 'Ghost Reporter' });
    const missingId = '99999999-9999-4999-8999-999999999999';

    const response = await requestApp()
      .post('/api/v1/moderation/reports')
      .set(authHeaders(reporter.id))
      .send({ entityType: 'USER', entityId: missingId, reasonCode: 'ABUSIVE_BEHAVIOR' })
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects reporting your own account with 422', async () => {
    const reporter = await newUser({ displayName: 'Self Reporter' });

    const response = await requestApp()
      .post('/api/v1/moderation/reports')
      .set(authHeaders(reporter.id))
      .send({ entityType: 'USER', entityId: reporter.id, reasonCode: 'ABUSIVE_BEHAVIOR' })
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an unauthenticated request with 401 before reaching the controller', async () => {
    const target = await newUser({ displayName: 'Unauth Report Target' });

    const response = await requestApp()
      .post('/api/v1/moderation/reports')
      .send({ entityType: 'USER', entityId: target.id, reasonCode: 'ABUSIVE_BEHAVIOR' })
      .expect(401);

    expect(response.body.error.code).toBe('AUTH_REQUIRED');

    const count = await query(
      'SELECT count(*)::int AS n FROM moderation_reports WHERE entity_id = $1',
      [target.id],
    );
    expect(count.rows[0].n).toBe(0);
  });

  it('rejects a suspended actor with 403 before any report write', async () => {
    const reporter = await newUser({ displayName: 'Suspended Reporter', status: 'SUSPENDED' });
    const target = await newUser({ displayName: 'Suspended Report Target' });

    const response = await requestApp()
      .post('/api/v1/moderation/reports')
      .set(authHeaders(reporter.id))
      .send({ entityType: 'USER', entityId: target.id, reasonCode: 'ABUSIVE_BEHAVIOR' })
      .expect(403);

    expect(response.body.error.code).toBe('ACCOUNT_SUSPENDED');

    const count = await query(
      'SELECT count(*)::int AS n FROM moderation_reports WHERE reporter_id = $1',
      [reporter.id],
    );
    expect(count.rows[0].n).toBe(0);
  });
});
