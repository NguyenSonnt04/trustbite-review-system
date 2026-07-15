import { pool } from '../config/db.js';
import { createHttpError } from '../utils/httpErrors.js';
import {
  getRestaurantById,
  updateRestaurant,
} from './restaurantService.js';
import { listRestaurantImages } from './restaurantImageService.js';
import { resolveRestaurantImageUrl } from './s3RestaurantImageStorageService.js';

const RESTAURANT_STATUSES = new Set(['DRAFT', 'ACTIVE', 'SUSPENDED', 'CLOSED']);
const RESTAURANT_UPDATE_FIELDS = new Set([
  'name',
  'description',
  'address',
  'phoneNumber',
  'latitude',
  'longitude',
  'categoryIds',
  'status',
  'reason',
]);

const assertAllowedFields = (body, allowedFields) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'Request body must be an object');
  }
  const unknownField = Object.keys(body).find((field) => !allowedFields.has(field));
  if (unknownField) {
    throw createHttpError(422, 'VALIDATION_ERROR', `Unsupported field: ${unknownField}`);
  }
};

const getActorRole = (actor) => {
  const roles = new Set((actor?.roles || []).map((role) => String(role).toUpperCase()));
  if (roles.has('SUPER_ADMIN')) return 'SUPER_ADMIN';
  if (roles.has('ADMIN')) return 'ADMIN';
  throw createHttpError(403, 'FORBIDDEN', 'Admin role required');
};

const normalizeOptionalText = (value, field, maxLength) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw createHttpError(422, 'VALIDATION_ERROR', `${field} must be a string or null`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw createHttpError(422, 'VALIDATION_ERROR', `${field} must be at most ${maxLength} characters`);
  }
  return normalized || null;
};

const normalizeName = (value) => {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 200) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'name must contain 1 to 200 characters');
  }
  return value.trim();
};

const normalizeStatus = (value) => {
  if (value === undefined) return undefined;
  const status = String(value).trim().toUpperCase();
  if (!RESTAURANT_STATUSES.has(status)) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'status is invalid');
  }
  return status;
};

const normalizeCategoryIds = (value) => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'categoryIds must be an array');
  }
  const categoryIds = [...new Set(value.map(Number))];
  if (categoryIds.some((id) => !Number.isInteger(id) || id < 1)) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'categoryIds must contain positive integers');
  }
  return categoryIds;
};

const normalizeReason = (value) => {
  if (typeof value !== 'string' || value.trim().length < 10 || value.trim().length > 500) {
    throw createHttpError(422, 'ADMIN_REASON_REQUIRED', 'reason must contain 10 to 500 characters');
  }
  return value.trim();
};

const normalizeCoordinates = (body) => {
  const hasLatitude = Object.prototype.hasOwnProperty.call(body, 'latitude');
  const hasLongitude = Object.prototype.hasOwnProperty.call(body, 'longitude');
  if (!hasLatitude && !hasLongitude) return {};
  if (!hasLatitude || !hasLongitude) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'latitude and longitude must be supplied together');
  }
  if (body.latitude === null && body.longitude === null) {
    return { latitude: null, longitude: null, clearGeo: true };
  }
  if (body.latitude === null || body.longitude === null) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'coordinates must both be null or numeric');
  }
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  if (
    !Number.isFinite(latitude)
    || latitude < -90
    || latitude > 90
    || !Number.isFinite(longitude)
    || longitude < -180
    || longitude > 180
  ) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'coordinates are invalid');
  }
  return { latitude, longitude, clearGeo: false };
};

const parseListQuery = (query = {}) => {
  const page = Number(query.page ?? 1);
  const pageSize = Number(query.pageSize ?? 20);
  if (!Number.isInteger(page) || page < 1) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'page must be a positive integer');
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'pageSize must be between 1 and 100');
  }
  const keyword = query.keyword == null ? '' : String(query.keyword).trim();
  if (keyword.length > 200) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'keyword must be at most 200 characters');
  }
  const status = query.status == null || query.status === ''
    ? null
    : normalizeStatus(query.status);
  return { page, pageSize, keyword, status };
};

const mapListRow = async (row) => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  address: row.address,
  status: row.status,
  trustScore: row.trust_score == null ? null : Number(row.trust_score),
  primaryImageUrl: await resolveRestaurantImageUrl(row.primary_image_url),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class AdminRestaurantManagementService {
  async listRestaurants(actor, query = {}) {
    getActorRole(actor);
    const { page, pageSize, keyword, status } = parseListQuery(query);
    const result = await pool.query(
      `WITH filtered AS (
         SELECT r.*,
           (
             SELECT ri.image_url
             FROM restaurant_images ri
             WHERE ri.restaurant_id = r.id
               AND ri.branch_id IS NULL
               AND ri.is_primary = TRUE
             ORDER BY ri.created_at DESC, ri.id DESC
             LIMIT 1
           ) AS primary_image_url
         FROM restaurants r
         WHERE r.is_deleted = FALSE
           AND ($1::text = '' OR r.name ILIKE '%' || $1 || '%' OR r.address ILIKE '%' || $1 || '%')
           AND ($2::text IS NULL OR r.status = $2)
       )
       SELECT page_rows.*, total.total_count
       FROM (SELECT count(*)::integer AS total_count FROM filtered) total
       LEFT JOIN LATERAL (
         SELECT * FROM filtered
         ORDER BY updated_at DESC, id DESC
         LIMIT $3 OFFSET $4
       ) page_rows ON true`,
      [keyword, status, pageSize, (page - 1) * pageSize],
    );
    return {
      items: await Promise.all(
        result.rows.filter((row) => row.id).map((row) => mapListRow(row)),
      ),
      page,
      pageSize,
      total: result.rows[0]?.total_count ?? 0,
    };
  }

  async getRestaurant(actor, restaurantId) {
    getActorRole(actor);
    const restaurant = await getRestaurantById(restaurantId);
    if (!restaurant) {
      throw createHttpError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant not found');
    }
    const [images, categories] = await Promise.all([
      listRestaurantImages({
        userId: actor.id,
        roles: actor.roles,
        restaurantId,
      }),
      pool.query(
        `SELECT id, code, label
         FROM restaurant_categories
         ORDER BY label ASC, id ASC`,
      ),
    ]);
    return {
      ...restaurant,
      images: images.items,
      availableCategories: categories.rows,
    };
  }

  async updateRestaurant(actor, restaurantId, body = {}) {
    const actorRole = getActorRole(actor);
    assertAllowedFields(body, RESTAURANT_UPDATE_FIELDS);
    const reason = normalizeReason(body.reason);
    const updates = {
      name: normalizeName(body.name),
      description: normalizeOptionalText(body.description, 'description', 5000),
      address: normalizeOptionalText(body.address, 'address', 1000),
      phoneNumber: normalizeOptionalText(body.phoneNumber, 'phoneNumber', 30),
      status: normalizeStatus(body.status),
      categoryIds: normalizeCategoryIds(body.categoryIds),
      ...normalizeCoordinates(body),
    };
    Object.keys(updates).forEach((key) => {
      if (updates[key] === undefined) delete updates[key];
    });
    if (Object.keys(updates).length === 0) {
      throw createHttpError(422, 'VALIDATION_ERROR', 'At least one restaurant field is required');
    }

    const responseContext = await this.getRestaurant(actor, restaurantId);
    const changedFields = Object.keys(updates).filter((key) => key !== 'clearGeo');
    const updated = await updateRestaurant(restaurantId, updates, {
      onBeforeCommit: async (client, { previous }) => {
        await client.query(
          `INSERT INTO audit_logs (
             actor_id, actor_role, action, entity_type, entity_id,
             previous_status, new_status, reason, metadata
           )
           VALUES ($1, $2, 'RESTAURANT_UPDATE', 'RESTAURANT', $3, $4, $5, $6, $7::jsonb)`,
          [
            actor.id,
            actorRole,
            restaurantId,
            previous.status,
            updates.status ?? previous.status,
            reason,
            JSON.stringify({ changedFields }),
          ],
        );
      },
    });
    if (!updated) {
      throw createHttpError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant not found');
    }
    return {
      ...updated,
      images: responseContext.images,
      availableCategories: responseContext.availableCategories,
    };
  }
}

export const adminRestaurantManagementService = new AdminRestaurantManagementService();
