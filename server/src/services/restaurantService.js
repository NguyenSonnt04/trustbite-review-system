/**
 * restaurantService.js
 * Business logic and persistence coordination for the Restaurant domain.
 * All raw DB access goes through this service; controllers must not touch the pool directly.
 *
 * Domain rules implemented here:
 *  - BR-REST-001: public list returns ACTIVE restaurants only.
 *  - Slug generation: slugify(name) + '-' + 6 random hex chars, retried on collision.
 *  - PostGIS geo column kept in sync with latitude/longitude on write.
 *  - Soft-delete: sets is_deleted = TRUE and deleted_at = NOW().
 *  - category_ids are validated and wired via restaurant_category_map.
 */

import crypto from 'crypto';
import { pool } from '../config/db.js';

// ---------------------------------------------------------------------------
// Domain errors
// ---------------------------------------------------------------------------

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 422;
    this.code = 'VALIDATION_ERROR';
  }
}

export class ConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = 409;
    this.code = 'CONFLICT';
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_SLUG_ATTEMPTS = 5;

function isSlugConflict(err) {
  return err.code === '23505' && err.constraint === 'restaurants_slug_key';
}

function uniqueIds(ids = []) {
  return [...new Set(ids)];
}

/**
 * Convert a display name into a URL-safe slug fragment.
 * Strips diacritics, lowercases, replaces non-alphanumeric runs with hyphens.
 */
function slugify(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

/**
 * Generate a unique slug candidate: <slugifiedName>-<6 random hex chars>.
 */
function generateSlug(name) {
  const base = slugify(name) || 'restaurant';
  const suffix = crypto.randomBytes(3).toString('hex');
  return `${base}-${suffix}`;
}

/**
 * Build the PostGIS point expression for a parameterised query.
 * Returns a SQL fragment using the two parameter positions [longitude, latitude].
 */
function geoExpression(paramOffset) {
  return `ST_SetSRID(ST_MakePoint($${paramOffset}, $${paramOffset + 1}), 4326)`;
}

/** Common SELECT projection for a restaurant and its aggregated category IDs. */
const RESTAURANT_SELECT_PROJECTION = `
  SELECT
    r.*,
    COALESCE(
      ARRAY_AGG(rcm.category_id) FILTER (WHERE rcm.category_id IS NOT NULL),
      '{}'::integer[]
    ) AS category_ids
  FROM restaurants r
  LEFT JOIN restaurant_category_map rcm ON rcm.restaurant_id = r.id
`;

/**
 * Map a DB row to a camelCase public-facing object.
 */
function toPublic(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    phoneNumber: row.phone_number,
    address: row.address,
    latitude: row.latitude !== null ? parseFloat(row.latitude) : null,
    longitude: row.longitude !== null ? parseFloat(row.longitude) : null,
    status: row.status,
    trustScore: row.trust_score !== null ? parseFloat(row.trust_score) : null,
    verifiedReviewCount: row.verified_review_count,
    referenceReviewCount: row.reference_review_count,
    categoryIds: row.category_ids ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function validateCategoryIds(client, categoryIds) {
  const ids = uniqueIds(categoryIds);
  if (ids.length === 0) return ids;

  const result = await client.query(
    'SELECT id FROM restaurant_categories WHERE id = ANY($1::int[])',
    [ids],
  );
  const existing = new Set(result.rows.map((row) => row.id));
  const missing = ids.filter((id) => !existing.has(id));

  if (missing.length > 0) {
    throw new ValidationError(`Invalid category_ids: ${missing.join(', ')}.`);
  }

  return ids;
}

async function bulkInsertCategoryMappings(client, restaurantId, ids) {
  if (ids.length === 0) return;
  const valuePlaceholders = ids.map((_, i) => `($1, $${i + 2})`).join(', ');
  await client.query(
    `INSERT INTO restaurant_category_map (restaurant_id, category_id) VALUES ${valuePlaceholders} ON CONFLICT DO NOTHING`,
    [restaurantId, ...ids],
  );
}

async function replaceCategoryMappings(client, restaurantId, categoryIds) {
  const ids = await validateCategoryIds(client, categoryIds);
  await client.query('DELETE FROM restaurant_category_map WHERE restaurant_id = $1', [restaurantId]);
  await bulkInsertCategoryMappings(client, restaurantId, ids);
}

async function insertCategoryMappings(client, restaurantId, categoryIds) {
  const ids = await validateCategoryIds(client, categoryIds);
  await bulkInsertCategoryMappings(client, restaurantId, ids);
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * List restaurants.
 *
 * @param {object} opts
 * @param {string}  [opts.keyword]   - Optional name filter (case-insensitive substring).
 * @param {string}  [opts.status]    - Public list is forced to ACTIVE (BR-REST-001).
 * @param {number}  [opts.page]      - 1-based page number. Default 1.
 * @param {number}  [opts.pageSize]  - Items per page. Default 20, max 100.
 * @returns {Promise<{ items: object[], page: number, pageSize: number, total: number }>}
 */
export async function listRestaurants({ keyword, page = 1, pageSize = 20 } = {}) {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeSize = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
  const offset = (safePage - 1) * safeSize;

  const params = ['ACTIVE'];
  const conditions = ['r.status = $1', 'r.is_deleted = FALSE'];

  if (keyword && keyword.trim()) {
    params.push(`%${keyword.trim()}%`);
    conditions.push(`r.name ILIKE $${params.length}`);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const dataQuery = `
    ${RESTAURANT_SELECT_PROJECTION}
    ${whereClause}
    GROUP BY r.id
    ORDER BY r.name ASC
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2}
  `;

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM restaurants r
    ${whereClause}
  `;

  const dataParams = [...params, safeSize, offset];
  const countParams = [...params];

  const [dataResult, countResult] = await Promise.all([
    pool.query(dataQuery, dataParams),
    pool.query(countQuery, countParams),
  ]);

  return {
    items: dataResult.rows.map(toPublic),
    page: safePage,
    pageSize: safeSize,
    total: parseInt(countResult.rows[0].total, 10),
  };
}

/**
 * Get a single restaurant by ID.
 *
 * @param {string} restaurantId - UUID
 * @returns {Promise<object|null>} Restaurant object or null if not found.
 */
export async function getRestaurantById(restaurantId) {
  const result = await pool.query(
    `
    ${RESTAURANT_SELECT_PROJECTION}
    WHERE r.id = $1
      AND r.is_deleted = FALSE
    GROUP BY r.id
    `,
    [restaurantId],
  );

  return result.rows.length > 0 ? toPublic(result.rows[0]) : null;
}

async function createRestaurantAttempt({ name, description, address, phoneNumber, latitude, longitude, categoryIds = [] }) {
  const slug = generateSlug(name);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let row;
    const result = await client.query(
      `
      INSERT INTO restaurants (name, slug, description, address, phone_number, latitude, longitude, geo)
      VALUES ($1, $2, $3, $4, $5, $6, $7,
        CASE WHEN $6::numeric IS NOT NULL AND $7::numeric IS NOT NULL
             THEN ST_SetSRID(ST_MakePoint($7, $6), 4326)
             ELSE NULL
        END)
      RETURNING *
      `,
      [
        name,
        slug,
        description ?? null,
        address ?? null,
        phoneNumber ?? null,
        latitude ?? null,
        longitude ?? null,
      ],
    );
    row = result.rows[0];

    await insertCategoryMappings(client, row.id, categoryIds);

    await client.query('COMMIT');
    return getRestaurantById(row.id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Create a new restaurant.
 *
 * @param {object} data
 * @param {string}    data.name
 * @param {string}    [data.description]
 * @param {string}    [data.address]
 * @param {string}    [data.phoneNumber]
 * @param {number}    [data.latitude]
 * @param {number}    [data.longitude]
 * @param {number[]}  [data.categoryIds]
 * @returns {Promise<object>} Created restaurant.
 */
export async function createRestaurant(data) {
  for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt += 1) {
    try {
      return await createRestaurantAttempt(data);
    } catch (err) {
      if (!isSlugConflict(err)) throw err;
      if (attempt === MAX_SLUG_ATTEMPTS) {
        throw new ConflictError('Could not allocate a unique restaurant slug. Please try again.');
      }
    }
  }

  throw new ConflictError('Could not allocate a unique restaurant slug. Please try again.');
}

/**
 * Update an existing restaurant.
 *
 * @param {string} restaurantId - UUID of restaurant to update.
 * @param {object} updates
 * @param {string}    [updates.name]
 * @param {string|null} [updates.description]
 * @param {string|null} [updates.address]
 * @param {string|null} [updates.phoneNumber]
 * @param {number|null} [updates.latitude]
 * @param {number|null} [updates.longitude]
 * @param {boolean}     [updates.clearGeo]
 * @param {string}      [updates.status]
 * @param {number[]}    [updates.categoryIds]
 * @returns {Promise<object|null>} Updated restaurant or null if not found.
 */
export async function updateRestaurant(restaurantId, updates) {
  const { name } = updates;

  for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt += 1) {
    try {
      return await updateRestaurantAttempt(restaurantId, updates);
    } catch (err) {
      if (!isSlugConflict(err) || name === undefined) throw err;
      if (attempt === MAX_SLUG_ATTEMPTS) {
        throw new ConflictError('Could not allocate a unique restaurant slug after renaming. Please try again.');
      }
    }
  }

  throw new ConflictError('Could not allocate a unique restaurant slug after renaming. Please try again.');
}

async function updateRestaurantAttempt(restaurantId, updates) {
  const { name, description, address, phoneNumber, latitude, longitude, clearGeo, status, categoryIds } = updates;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const setClauses = [];
    const params = [restaurantId]; // $1 = restaurantId

    const addParam = (value) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (name !== undefined) {
      setClauses.push(`name = ${addParam(name)}`);
      const newSlug = generateSlug(name);
      setClauses.push(`slug = ${addParam(newSlug)}`);
    }
    if (description !== undefined) {
      setClauses.push(`description = ${addParam(description)}`);
    }
    if (address !== undefined) {
      setClauses.push(`address = ${addParam(address)}`);
    }
    if (phoneNumber !== undefined) {
      setClauses.push(`phone_number = ${addParam(phoneNumber)}`);
    }
    if (status !== undefined) {
      setClauses.push(`status = ${addParam(status)}`);
    }

    if (clearGeo === true) {
      setClauses.push('latitude = NULL');
      setClauses.push('longitude = NULL');
      setClauses.push('geo = NULL');
    } else if (latitude !== undefined && longitude !== undefined) {
      setClauses.push(`latitude = ${addParam(latitude)}`);
      setClauses.push(`longitude = ${addParam(longitude)}`);
      params.push(longitude, latitude);
      const lngIdx = params.length - 1;
      const latIdx = params.length;
      setClauses.push(`geo = ST_SetSRID(ST_MakePoint($${lngIdx}, $${latIdx}), 4326)`);
    }

    if (setClauses.length === 0 && categoryIds === undefined) {
      await client.query('ROLLBACK');
      return getRestaurantById(restaurantId);
    }

    if (setClauses.length > 0) {
      const result = await client.query(
        `UPDATE restaurants SET ${setClauses.join(', ')} WHERE id = $1 AND is_deleted = FALSE RETURNING *`,
        params,
      );
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }
    } else {
      // Only categories changing — confirm restaurant exists and not deleted
      const checkResult = await client.query('SELECT id FROM restaurants WHERE id = $1 AND is_deleted = FALSE', [restaurantId]);
      if (checkResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }
    }

    if (categoryIds !== undefined) {
      await replaceCategoryMappings(client, restaurantId, categoryIds);
    }

    await client.query('COMMIT');
    return getRestaurantById(restaurantId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Soft-delete a restaurant by setting is_deleted = TRUE.
 *
 * @param {string} restaurantId - UUID
 * @returns {Promise<boolean>} true if found and updated, false if not found.
 */
export async function deleteRestaurant(restaurantId) {
  const result = await pool.query(
    `
    UPDATE restaurants
    SET is_deleted = TRUE, deleted_at = NOW()
    WHERE id = $1 AND is_deleted = FALSE
    RETURNING id
    `,
    [restaurantId],
  );
  return result.rows.length > 0;
}