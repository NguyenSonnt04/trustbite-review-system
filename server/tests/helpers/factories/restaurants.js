import { query } from '../db.js';
import crypto from 'node:crypto';

let restaurantSequence = 0;
const restaurantPrefix = crypto.randomUUID();

export async function createRestaurant(overrides = {}) {
  restaurantSequence += 1;
  const slug = overrides.slug ?? `test-restaurant-${restaurantPrefix}-${restaurantSequence}`;

  const result = await query(
    `
    INSERT INTO restaurants (
      name, slug, description, phone_number, address,
      latitude, longitude, status, trust_score,
      verified_review_count, reference_review_count, is_deleted
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *
    `,
    [
      overrides.name ?? `Test Restaurant ${restaurantSequence}`,
      slug,
      overrides.description ?? null,
      overrides.phoneNumber ?? null,
      overrides.address ?? '123 Test Street',
      overrides.latitude ?? null,
      overrides.longitude ?? null,
      overrides.status ?? 'ACTIVE',
      overrides.trustScore ?? 5.0,
      overrides.verifiedReviewCount ?? 0,
      overrides.referenceReviewCount ?? 0,
      overrides.isDeleted ?? false,
    ],
  );

  return result.rows[0];
}
