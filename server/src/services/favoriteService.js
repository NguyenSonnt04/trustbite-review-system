import { pool } from '../config/db.js';
import { createHttpError } from '../utils/httpErrors.js';
import { resolveRestaurantImageUrl } from './s3RestaurantImageStorageService.js';

const DEFAULT_FAVORITES_LIST_NAME = 'Yêu thích';

async function safeRollback(client) {
  try {
    await client.query('ROLLBACK');
  } catch {
    // Preserve the original persistence or domain error.
  }
}

async function lockUserFavorites(client, userId) {
  // The schema has no uniqueness constraint for a default list. Serialize every
  // API-created default list for one user inside the surrounding transaction.
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [userId]);
}

async function findOrCreateDefaultList(client, userId) {
  const existing = await client.query(
    `SELECT id
     FROM user_saved_lists
     WHERE user_id = $1
       AND name = $2
       AND is_public = FALSE
     ORDER BY created_at ASC, id ASC
     LIMIT 1
     FOR UPDATE`,
    [userId, DEFAULT_FAVORITES_LIST_NAME],
  );

  if (existing.rowCount > 0) {
    return existing.rows[0].id;
  }

  const inserted = await client.query(
    `INSERT INTO user_saved_lists (user_id, name, is_public)
     VALUES ($1, $2, FALSE)
     RETURNING id`,
    [userId, DEFAULT_FAVORITES_LIST_NAME],
  );
  return inserted.rows[0].id;
}

async function resolvePublicImage(reference) {
  try {
    return await resolveRestaurantImageUrl(reference);
  } catch {
    return null;
  }
}

export async function listFavoriteRestaurants(userId) {
  const result = await pool.query(
    `WITH default_list AS (
       SELECT id, user_id
       FROM user_saved_lists
       WHERE user_id = $1
         AND name = $2
         AND is_public = FALSE
       ORDER BY created_at ASC, id ASC
       LIMIT 1
     )
     SELECT
       restaurant.id,
       restaurant.name,
       restaurant.trust_score,
       restaurant.verified_review_count,
       saved.added_at,
       (
         SELECT image.image_url
         FROM restaurant_images image
         WHERE image.restaurant_id = restaurant.id
           AND image.branch_id IS NULL
           AND image.is_primary = TRUE
         ORDER BY image.created_at DESC, image.id DESC
         LIMIT 1
       ) AS primary_image_url
     FROM default_list list
     JOIN user_saved_list_restaurants saved ON saved.saved_list_id = list.id
     JOIN restaurants restaurant ON restaurant.id = saved.restaurant_id
     WHERE list.user_id = $1
       AND restaurant.is_deleted = FALSE
       AND restaurant.status = 'ACTIVE'
     ORDER BY saved.added_at DESC, restaurant.id DESC`,
    [userId, DEFAULT_FAVORITES_LIST_NAME],
  );

  const items = await Promise.all(result.rows.map(async (row) => ({
    id: row.id,
    name: row.name,
    primaryImageUrl: await resolvePublicImage(row.primary_image_url),
    trustScore: row.trust_score === null ? null : Number(row.trust_score),
    verifiedReviewCount: Number(row.verified_review_count),
    addedAt: row.added_at,
  })));

  return { items };
}

export async function saveFavoriteRestaurant(userId, restaurantId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await lockUserFavorites(client, userId);

    const restaurant = await client.query(
      `SELECT id
       FROM restaurants
       WHERE id = $1
         AND is_deleted = FALSE
         AND status = 'ACTIVE'`,
      [restaurantId],
    );
    if (restaurant.rowCount === 0) {
      throw createHttpError(
        404,
        'RESTAURANT_NOT_FOUND',
        'Restaurant not found',
      );
    }

    const listId = await findOrCreateDefaultList(client, userId);
    const inserted = await client.query(
      `INSERT INTO user_saved_list_restaurants (saved_list_id, restaurant_id)
       VALUES ($1, $2)
       ON CONFLICT (saved_list_id, restaurant_id) DO NOTHING
       RETURNING restaurant_id`,
      [listId, restaurantId],
    );

    await client.query('COMMIT');
    return {
      saved: true,
      created: inserted.rowCount > 0,
    };
  } catch (error) {
    await safeRollback(client);
    throw error;
  } finally {
    client.release();
  }
}

export async function removeFavoriteRestaurant(userId, restaurantId) {
  await pool.query(
    `DELETE FROM user_saved_list_restaurants saved
     USING user_saved_lists list
     WHERE saved.saved_list_id = list.id
       AND list.user_id = $1
       AND saved.restaurant_id = $2
       AND list.name = $3
       AND list.is_public = FALSE`,
    [userId, restaurantId, DEFAULT_FAVORITES_LIST_NAME],
  );

  return { success: true };
}
