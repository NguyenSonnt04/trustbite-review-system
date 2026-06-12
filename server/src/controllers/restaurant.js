/**
 * restaurant.js — Controller
 * Request/response orchestration for the Restaurant domain.
 * All business logic and DB access is delegated to restaurantService.
 *
 * Endpoints (mounted under /api/v1/restaurants):
 *   GET    /              → listRestaurantsHandler
 *   POST   /              → createRestaurantHandler
 *   GET    /:restaurantId → getRestaurantHandler
 *   PATCH  /:restaurantId → updateRestaurantHandler
 *   DELETE /:restaurantId → deleteRestaurantHandler
 *
 * Request convention  : snake_case (phone_number, category_ids) per API spec.
 * Response convention : camelCase via service toPublic().
 */

import * as restaurantService from '../services/restaurantService.js';
import { listPublicReviewsByRestaurant } from '../services/reviewService.js';

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** BR-REST-001: public listing is ACTIVE-only; admin-scoped listing is out of scope. */
const PUBLIC_ALLOWED_STATUSES = ['ACTIVE'];

const VALID_STATUSES = ['DRAFT', 'ACTIVE', 'SUSPENDED', 'CLOSED'];

function isValidUUID(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

function buildRequestId(req) {
  return req.headers['x-request-id'] ?? `req_${Date.now()}`;
}

function errorResponse(res, statusCode, code, message, requestId) {
  return res.status(statusCode).json({
    error: { code, message, requestId },
  });
}

/**
 * Strictly parse a positive integer from a query string value.
 * Returns { value: number } on success, { error: true } on failure.
 */
function parsePositiveInt(raw) {
  if (raw === undefined) return { value: undefined };
  if (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw)) return { error: true };
  return { value: Number(raw) };
}

/**
 * Validate an optional string field at the HTTP boundary.
 * Returns an error message string if invalid, otherwise null.
 */
function validateOptionalString(value, fieldName, { maxLength } = {}) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return `${fieldName} must be a string.`;
  if (maxLength && value.length > maxLength) return `${fieldName} must be at most ${maxLength} characters.`;
  return null;
}

/**
 * Check whether a key is explicitly present on the parsed body
 * (distinguishes null from missing).
 */
function hasKey(body, key) {
  return Object.prototype.hasOwnProperty.call(body ?? {}, key);
}

// ---------------------------------------------------------------------------
// GET /api/v1/restaurants
// ---------------------------------------------------------------------------

/**
 * List restaurants.
 * Query params: keyword, status (must be ACTIVE per BR-REST-001), page (default 1), pageSize (default 20).
 * Per BR-REST-001, public listing is restricted to ACTIVE restaurants only.
 * Admin-scoped listing is out of scope for this story.
 */
export const listRestaurantsHandler = async (req, res, next) => {
  try {
    const { keyword, status, page, pageSize } = req.query;
    const requestId = buildRequestId(req);

    // Validate keyword is a single string if provided
    if (keyword !== undefined && typeof keyword !== 'string') {
      return errorResponse(res, 422, 'VALIDATION_ERROR', 'keyword must be a string.', requestId);
    }

    // BR-REST-001: public listing is ACTIVE-only; reject any other status request.
    if (status !== undefined && !PUBLIC_ALLOWED_STATUSES.includes(status)) {
      return errorResponse(
        res, 422, 'VALIDATION_ERROR',
        `Public listing only supports status: ${PUBLIC_ALLOWED_STATUSES.join(', ')}.`,
        requestId,
      );
    }

    // Strict pagination parsing — reject malformed values like "1abc" or "20xyz".
    const parsedPage = parsePositiveInt(page);
    if (parsedPage.error) {
      return errorResponse(res, 422, 'VALIDATION_ERROR', 'page must be a positive integer.', requestId);
    }
    const parsedSize = parsePositiveInt(pageSize);
    if (parsedSize.error) {
      return errorResponse(res, 422, 'VALIDATION_ERROR', 'pageSize must be a positive integer.', requestId);
    }

    const result = await restaurantService.listRestaurants({
      keyword: keyword?.trim() || undefined,
      status: 'ACTIVE', // always ACTIVE for public endpoint regardless of query param
      page: parsedPage.value ?? 1,
      pageSize: parsedSize.value ?? 20,
    });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/v1/restaurants/:restaurantId
// ---------------------------------------------------------------------------

/**
 * Get a single restaurant by UUID.
 */
export const getRestaurantHandler = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;
    const requestId = buildRequestId(req);

    if (!isValidUUID(restaurantId)) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', 'restaurantId must be a valid UUID.', requestId);
    }

    const restaurant = await restaurantService.getRestaurantDetail(restaurantId);

    if (!restaurant) {
      return errorResponse(res, 404, 'RESTAURANT_NOT_FOUND', 'Restaurant not found.', requestId);
    }

    return res.status(200).json(restaurant);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/v1/restaurants/:restaurantId/reviews
// ---------------------------------------------------------------------------

/**
 * List public reviews for a restaurant.
 * Unauthenticated public listing. Responses must omit reviewer userId values.
 * Query params: status (VERIFIED | REFERENCE_ONLY | ALL), page, pageSize
 */
export const listRestaurantReviewsHandler = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;
    const { status, page, pageSize } = req.query;
    const requestId = buildRequestId(req);

    if (!isValidUUID(restaurantId)) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', 'restaurantId must be a valid UUID.', requestId);
    }

    if (status !== undefined && !['VERIFIED', 'REFERENCE_ONLY', 'ALL'].includes(status)) {
      return errorResponse(res, 422, 'VALIDATION_ERROR', 'status must be VERIFIED, REFERENCE_ONLY, or ALL.', requestId);
    }

    const parsedPage = parsePositiveInt(page);
    if (parsedPage.error) {
      return errorResponse(res, 422, 'VALIDATION_ERROR', 'page must be a positive integer.', requestId);
    }
    const parsedSize = parsePositiveInt(pageSize);
    if (parsedSize.error) {
      return errorResponse(res, 422, 'VALIDATION_ERROR', 'pageSize must be a positive integer.', requestId);
    }

    // First check if restaurant exists and is public (ACTIVE)
    const restaurantExists = await restaurantService.publicRestaurantExists(restaurantId);
    if (!restaurantExists) {
      return errorResponse(res, 404, 'NOT_FOUND', 'Restaurant not found.', requestId);
    }

    const result = await listPublicReviewsByRestaurant(restaurantId, {
      status: status ?? 'ALL',
      page: parsedPage.value ?? 1,
      pageSize: parsedSize.value ?? 20,
    });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/v1/restaurants
// ---------------------------------------------------------------------------

/**
 * Create a new restaurant.
 * Request body (snake_case per API spec):
 *   { name, description?, address?, phone_number?, latitude?, longitude?, category_ids? }
 */
export const createRestaurantHandler = async (req, res, next) => {
  try {
    const requestId = buildRequestId(req);
    const body = req.body ?? {};

    // Read snake_case request fields per API contract.
    const {
      name,
      description,
      address,
      phone_number: phoneNumber,
      latitude,
      longitude,
      category_ids: categoryIds,
    } = body;

    // --- Required fields ---
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return errorResponse(res, 422, 'VALIDATION_ERROR', 'name is required and must be a non-empty string.', requestId);
    }
    if (name.trim().length > 200) {
      return errorResponse(res, 422, 'VALIDATION_ERROR', 'name must be at most 200 characters.', requestId);
    }

    // --- Optional string field type validation ---
    const descErr = validateOptionalString(description, 'description');
    if (descErr) return errorResponse(res, 422, 'VALIDATION_ERROR', descErr, requestId);

    const addrErr = validateOptionalString(address, 'address');
    if (addrErr) return errorResponse(res, 422, 'VALIDATION_ERROR', addrErr, requestId);

    const phoneErr = validateOptionalString(phoneNumber, 'phone_number', { maxLength: 30 });
    if (phoneErr) return errorResponse(res, 422, 'VALIDATION_ERROR', phoneErr, requestId);

    // --- Geo validation: both or neither ---
    const hasLat = hasKey(body, 'latitude') && latitude !== null && latitude !== undefined;
    const hasLng = hasKey(body, 'longitude') && longitude !== null && longitude !== undefined;
    const latNull = hasKey(body, 'latitude') && latitude === null;
    const lngNull = hasKey(body, 'longitude') && longitude === null;

    if ((hasLat || latNull) !== (hasLng || lngNull)) {
      return errorResponse(res, 422, 'VALIDATION_ERROR', 'latitude and longitude must both be provided together.', requestId);
    }
    if (hasLat && (typeof latitude !== 'number' || latitude < -90 || latitude > 90)) {
      return errorResponse(res, 422, 'VALIDATION_ERROR', 'latitude must be a number between -90 and 90.', requestId);
    }
    if (hasLng && (typeof longitude !== 'number' || longitude < -180 || longitude > 180)) {
      return errorResponse(res, 422, 'VALIDATION_ERROR', 'longitude must be a number between -180 and 180.', requestId);
    }

    // --- categoryIds: optional, array of positive integers ---
    if (categoryIds !== undefined) {
      if (!Array.isArray(categoryIds) || !categoryIds.every((c) => Number.isInteger(c) && c > 0)) {
        return errorResponse(res, 422, 'VALIDATION_ERROR', 'category_ids must be an array of positive integers.', requestId);
      }
    }

    const restaurant = await restaurantService.createRestaurant({
      name: name.trim(),
      description: description ?? null,
      address: address ?? null,
      phoneNumber: phoneNumber ?? null,
      latitude: hasLat ? latitude : null,
      longitude: hasLng ? longitude : null,
      categoryIds: categoryIds ? [...new Set(categoryIds)] : [],
    });

    return res.status(201).json(restaurant);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/v1/restaurants/:restaurantId
// ---------------------------------------------------------------------------

/**
 * Partially update a restaurant.
 * Request body (snake_case per API spec):
 *   { name?, description?, address?, phone_number?, latitude?, longitude?, status?, category_ids? }
 */
export const updateRestaurantHandler = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;
    const requestId = buildRequestId(req);

    if (!isValidUUID(restaurantId)) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', 'restaurantId must be a valid UUID.', requestId);
    }

    const body = req.body ?? {};

    // BR-REST-001: reject empty PATCH body
    if (body === null || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length === 0) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', 'At least one field must be provided for update.', requestId);
    }

    // Read snake_case request fields per API contract.
    const {
      name,
      description,
      address,
      phone_number: phoneNumber,
      latitude,
      longitude,
      status,
      category_ids: categoryIds,
    } = body;

    const updates = {};

    // --- name ---
    if (hasKey(body, 'name')) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return errorResponse(res, 422, 'VALIDATION_ERROR', 'name must be a non-empty string.', requestId);
      }
      if (name.trim().length > 200) {
        return errorResponse(res, 422, 'VALIDATION_ERROR', 'name must be at most 200 characters.', requestId);
      }
      updates.name = name.trim();
    }

    // --- Optional string fields ---
    if (hasKey(body, 'description')) {
      const descErr = validateOptionalString(description, 'description');
      if (descErr) return errorResponse(res, 422, 'VALIDATION_ERROR', descErr, requestId);
      updates.description = description ?? null;
    }

    if (hasKey(body, 'address')) {
      const addrErr = validateOptionalString(address, 'address');
      if (addrErr) return errorResponse(res, 422, 'VALIDATION_ERROR', addrErr, requestId);
      updates.address = address ?? null;
    }

    if (hasKey(body, 'phone_number')) {
      const phoneErr = validateOptionalString(phoneNumber, 'phone_number', { maxLength: 30 });
      if (phoneErr) return errorResponse(res, 422, 'VALIDATION_ERROR', phoneErr, requestId);
      updates.phoneNumber = phoneNumber ?? null;
    }

    // --- status ---
    if (hasKey(body, 'status')) {
      if (!VALID_STATUSES.includes(status)) {
        return errorResponse(
          res, 422, 'VALIDATION_ERROR',
          `status must be one of: ${VALID_STATUSES.join(', ')}.`,
          requestId,
        );
      }
      updates.status = status;
    }

    // --- Geo validation with explicit null-clear support ---
    const latPresent = hasKey(body, 'latitude');
    const lngPresent = hasKey(body, 'longitude');

    if (latPresent !== lngPresent) {
      return errorResponse(res, 422, 'VALIDATION_ERROR', 'latitude and longitude must both be provided together.', requestId);
    }

    if (latPresent && lngPresent) {
      const latIsNull = latitude === null;
      const lngIsNull = longitude === null;

      if (latIsNull !== lngIsNull) {
        return errorResponse(res, 422, 'VALIDATION_ERROR', 'latitude and longitude must both be null or both be numbers.', requestId);
      }

      if (!latIsNull) {
        // Both are expected to be valid numbers.
        if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
          return errorResponse(res, 422, 'VALIDATION_ERROR', 'latitude must be a number between -90 and 90.', requestId);
        }
        if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
          return errorResponse(res, 422, 'VALIDATION_ERROR', 'longitude must be a number between -180 and 180.', requestId);
        }
        updates.latitude = latitude;
        updates.longitude = longitude;
        updates.clearGeo = false;
      } else {
        // Both are null — intentionally clear location.
        updates.latitude = null;
        updates.longitude = null;
        updates.clearGeo = true;
      }
    }

    // --- categoryIds ---
    if (hasKey(body, 'category_ids')) {
      if (!Array.isArray(categoryIds) || !categoryIds.every((c) => Number.isInteger(c) && c > 0)) {
        return errorResponse(res, 422, 'VALIDATION_ERROR', 'category_ids must be an array of positive integers.', requestId);
      }
      updates.categoryIds = [...new Set(categoryIds)];
    }

    const restaurant = await restaurantService.updateRestaurant(restaurantId, updates);

    if (!restaurant) {
      return errorResponse(res, 404, 'RESTAURANT_NOT_FOUND', 'Restaurant not found.', requestId);
    }

    return res.status(200).json(restaurant);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/v1/restaurants/:restaurantId
// ---------------------------------------------------------------------------

/**
 * Soft-delete a restaurant (sets is_deleted = true).
 */
export const deleteRestaurantHandler = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;
    const requestId = buildRequestId(req);

    if (!isValidUUID(restaurantId)) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', 'restaurantId must be a valid UUID.', requestId);
    }
    const deleted = await restaurantService.deleteRestaurant(restaurantId);
    if (!deleted) {
      return errorResponse(res, 404, 'RESTAURANT_NOT_FOUND', 'Restaurant not found.', requestId);
    }
    return res.status(200).json({ success: true, message: 'Restaurant has been soft-deleted.' });
  } catch (err) {
    next(err);
  }
};