import { readFileSync } from 'node:fs';

import { afterAll, afterEach, describe, expect, it } from 'vitest';

const {
  createRestaurant,
  createReview,
  createUser,
} = await import('../helpers/factories/index.js');
const { pool } = await import('../../src/config/db.js');
const { closeDbPool, query } = await import('../helpers/db.js');

const migrationSql = readFileSync(
  new URL('../../migrations/011_strengthen_notification_award_indexes.sql', import.meta.url),
  'utf8',
);
const recomputeStart = migrationSql.indexOf('WITH affected_restaurants AS (');
const recomputeEnd = migrationSql.indexOf(
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_exp_transactions_review_verified_uniq',
  recomputeStart,
);
const recomputeSql = migrationSql.slice(recomputeStart, recomputeEnd).trim();

const createdUserIds = new Set();
const createdRestaurantIds = new Set();
const createdReviewIds = new Set();

describe('duplicate EXP trust-score migration', () => {
  afterEach(async () => {
    for (const reviewId of createdReviewIds) {
      await query('DELETE FROM reviews WHERE id = $1', [reviewId]);
    }
    for (const restaurantId of createdRestaurantIds) {
      await query('DELETE FROM restaurants WHERE id = $1', [restaurantId]);
    }
    for (const userId of createdUserIds) {
      await query('DELETE FROM users WHERE id = $1', [userId]);
    }
    createdReviewIds.clear();
    createdRestaurantIds.clear();
    createdUserIds.clear();
  });

  afterAll(async () => {
    await closeDbPool();
  });

  it('recomputes only restaurants affected by duplicate-award users using all eligible reviews', async () => {
    expect(recomputeStart).toBeGreaterThanOrEqual(0);
    expect(recomputeEnd).toBeGreaterThan(recomputeStart);

    const affectedUser = await createUser({ displayName: 'Duplicate EXP User' });
    const otherUser = await createUser({ displayName: 'Unaffected EXP User' });
    createdUserIds.add(affectedUser.id);
    createdUserIds.add(otherUser.id);

    const affectedRestaurant = await createRestaurant({
      name: 'Affected Trust Restaurant',
      trustScore: 1.11,
      verifiedReviewCount: 9,
      referenceReviewCount: 9,
    });
    const unaffectedRestaurant = await createRestaurant({
      name: 'Unchanged Trust Restaurant',
      trustScore: 4.44,
      verifiedReviewCount: 7,
      referenceReviewCount: 6,
    });
    createdRestaurantIds.add(affectedRestaurant.id);
    createdRestaurantIds.add(unaffectedRestaurant.id);

    const reviews = [
      await createReview({
        userId: affectedUser.id,
        restaurantId: affectedRestaurant.id,
        trustWeightBucket: 'HIGH',
      }),
      await createReview({
        userId: otherUser.id,
        restaurantId: affectedRestaurant.id,
        foodRating: 1,
        priceRating: 1,
        serviceRating: 1,
        ambienceRating: 1,
        trustWeightBucket: 'HIGH',
      }),
      await createReview({
        userId: otherUser.id,
        restaurantId: affectedRestaurant.id,
        foodRating: 4,
        priceRating: 4,
        serviceRating: 4,
        ambienceRating: 4,
        status: 'REFERENCE_ONLY',
        verificationStatus: 'SKIPPED',
        trustLabel: 'REFERENCE_ONLY',
        trustWeightBucket: 'LOW',
      }),
      await createReview({
        userId: otherUser.id,
        restaurantId: unaffectedRestaurant.id,
        foodRating: 2,
        priceRating: 2,
        serviceRating: 2,
        ambienceRating: 2,
        trustWeightBucket: 'HIGH',
      }),
    ];
    for (const review of reviews) createdReviewIds.add(review.id);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `CREATE TEMP TABLE notification_migration_duplicate_exp (
           user_id UUID PRIMARY KEY,
           duplicate_delta INTEGER NOT NULL
         ) ON COMMIT DROP`,
      );
      await client.query(
        `INSERT INTO notification_migration_duplicate_exp (user_id, duplicate_delta)
         VALUES ($1, 50)`,
        [affectedUser.id],
      );
      await client.query(recomputeSql);

      const result = await client.query(
        `SELECT id, trust_score, verified_review_count, reference_review_count
         FROM restaurants
         WHERE id = ANY($1::uuid[])
         ORDER BY id`,
        [[affectedRestaurant.id, unaffectedRestaurant.id]],
      );
      const byId = new Map(result.rows.map((row) => [row.id, row]));

      expect(Number(byId.get(affectedRestaurant.id).trust_score)).toBe(3.09);
      expect(byId.get(affectedRestaurant.id).verified_review_count).toBe(2);
      expect(byId.get(affectedRestaurant.id).reference_review_count).toBe(1);
      expect(Number(byId.get(unaffectedRestaurant.id).trust_score)).toBe(4.44);
      expect(byId.get(unaffectedRestaurant.id).verified_review_count).toBe(7);
      expect(byId.get(unaffectedRestaurant.id).reference_review_count).toBe(6);

      await client.query('ROLLBACK');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });
});
