import { query } from '../db.js';

let reviewSequence = 0;

export async function createReview({ userId, restaurantId, ...overrides } = {}) {
  if (!userId) throw new Error('createReview requires userId.');
  if (!restaurantId) throw new Error('createReview requires restaurantId.');

  reviewSequence += 1;

  const result = await query(
    `
    INSERT INTO reviews (
      user_id, restaurant_id, branch_id,
      food_rating, price_rating, service_rating, ambience_rating,
      comment, status, verification_status, trust_label,
      public_visibility, trust_weight_bucket, visited_at, hidden_reason
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING *
    `,
    [
      userId,
      restaurantId,
      overrides.branchId ?? null,
      overrides.foodRating ?? 5,
      overrides.priceRating ?? 5,
      overrides.serviceRating ?? 5,
      overrides.ambienceRating ?? 5,
      overrides.comment ?? `Test review ${reviewSequence}`,
      overrides.status ?? 'VERIFIED',
      overrides.verificationStatus ?? 'VERIFIED',
      overrides.trustLabel ?? 'TRUSTED',
      overrides.publicVisibility ?? 'PUBLIC',
      overrides.trustWeightBucket ?? 'FULL',
      overrides.visitedAt ?? null,
      overrides.hiddenReason ?? null,
    ],
  );

  return result.rows[0];
}
