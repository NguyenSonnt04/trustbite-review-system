import { pool } from '../config/db.js';
import { PENDING_ADMIN_REVIEW_PUBLIC_REASON } from '../config/receiptStatus.js';
import { createHttpError } from '../utils/httpErrors.js';
import { avatarUploadService } from './avatarStorageService.js';
import { recomputeRestaurantTrustScore } from './trustScoreService.js';

const REVIEW_SELECT_PROJECTION = `
  SELECT
    r.id,
    r.user_id AS "userId",
    r.restaurant_id AS "restaurantId",
    r.branch_id AS "branchId",
    r.food_rating AS "foodRating",
    r.price_rating AS "priceRating",
    r.service_rating AS "serviceRating",
    r.ambience_rating AS "ambienceRating",
    r.average_rating AS "averageRating",
    CASE
      WHEN u.status = 'DELETED' THEN NULL
      ELSE NULLIF(BTRIM(u.display_name), '')
    END AS "reviewerDisplayName",
    CASE
      WHEN u.status = 'DELETED' THEN NULL
      ELSE u.avatar_url
    END AS "reviewerAvatarReference",
    r.comment,
    r.status,
    r.verification_status AS "verificationStatus",
    r.trust_label AS "trustLabel",
    r.public_visibility AS "publicVisibility",
    r.trust_weight_bucket AS "trustWeightBucket",
    r.visited_at AS "visitedAt",
    r.created_at AS "createdAt",
    r.updated_at AS "updatedAt",
    reactions."loveCount",
    reactions."hahaCount",
    reactions."angryCount"
  FROM reviews r
  JOIN users u ON u.id = r.user_id
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) FILTER (WHERE reaction_type = 'LOVE')::int AS "loveCount",
      COUNT(*) FILTER (WHERE reaction_type = 'HAHA')::int AS "hahaCount",
      COUNT(*) FILTER (WHERE reaction_type = 'ANGRY')::int AS "angryCount"
    FROM review_reactions
    WHERE review_id = r.id
  ) reactions ON true
`;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MIN_VERIFIED_COMMENT_LENGTH = 50;
const RATING_FIELDS = ['foodRating', 'priceRating', 'serviceRating', 'ambienceRating'];

function toPublicReview(row, reviewerAvatarUrl = null) {
  return {
    id: row.id,
    restaurantId: row.restaurantId,
    branchId: row.branchId,
    reviewerDisplayName: row.reviewerDisplayName ?? 'Người dùng TrustBite',
    reviewerAvatarUrl,
    foodRating: row.foodRating,
    priceRating: row.priceRating,
    serviceRating: row.serviceRating,
    ambienceRating: row.ambienceRating,
    averageRating: row.averageRating !== null ? parseFloat(row.averageRating) : null,
    comment: row.comment,
    status: row.status,
    verificationStatus: row.verificationStatus,
    trustLabel: row.trustLabel,
    reactionCounts: {
      LOVE: Number(row.loveCount ?? 0),
      HAHA: Number(row.hahaCount ?? 0),
      ANGRY: Number(row.angryCount ?? 0),
    },
    visitedAt: row.visitedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toVerificationStatus(row) {
  return {
    reviewId: row.reviewId,
    restaurantId: row.restaurantId,
    branchId: row.branchId,
    status: row.status,
    verificationStatus: row.verificationStatus,
    trustLabel: row.trustLabel,
    publicVisibility: row.publicVisibility,
    trustWeightBucket: row.trustWeightBucket,
    visitedAt: row.visitedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    receipt: row.receiptVerificationId
      ? {
          receiptVerificationId: row.receiptVerificationId,
          status: row.receiptStatus,
          decision: row.receiptDecision,
          // Never expose internal admin-review reasons through the public API.
          decisionReason: row.receiptStatus === 'PENDING_ADMIN_REVIEW'
            ? PENDING_ADMIN_REVIEW_PUBLIC_REASON
            : row.receiptDecisionReason,
          capturedAt: row.receiptCapturedAt,
          decidedAt: row.receiptDecidedAt,
          createdAt: row.receiptCreatedAt,
          updatedAt: row.receiptUpdatedAt,
        }
      : null,
  };
}

function validationDetail(field, code, message) {
  return { field, code, message };
}

function assertUuid(value, field, details) {
  if (typeof value !== 'string' || !UUID_REGEX.test(value)) {
    details.push(validationDetail(field, 'INVALID_UUID', `${field} must be a valid UUID.`));
  }
}

function parseRating(value, field, details) {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    details.push(validationDetail(field, 'RANGE', `${field} must be an integer from 1 to 5.`));
    return null;
  }
  return value;
}

function parseVisitedAt(value, details) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    details.push(validationDetail('visitedAt', 'INVALID_TYPE', 'visitedAt must be an ISO-8601 datetime string.'));
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    details.push(validationDetail('visitedAt', 'INVALID_DATETIME', 'visitedAt must be a valid ISO-8601 datetime.'));
    return null;
  }

  if (date.getTime() > Date.now()) {
    details.push(validationDetail('visitedAt', 'FUTURE_DATETIME', 'visitedAt must not be in the future.'));
    return null;
  }

  return date.toISOString();
}

function validateCreateReviewPayload(payload = {}) {
  const details = [];
  const restaurantId = payload.restaurantId;
  const branchId = payload.branchId ?? null;

  assertUuid(restaurantId, 'restaurantId', details);
  if (branchId !== null) assertUuid(branchId, 'branchId', details);

  const ratings = {};
  for (const field of RATING_FIELDS) {
    ratings[field] = parseRating(payload[field], field, details);
  }

  const comment = typeof payload.comment === 'string' ? payload.comment.trim() : '';
  if (comment.length < MIN_VERIFIED_COMMENT_LENGTH) {
    details.push(validationDetail(
      'comment',
      'MIN_LENGTH',
      `Comment must be at least ${MIN_VERIFIED_COMMENT_LENGTH} characters.`,
    ));
  }

  const visitedAt = parseVisitedAt(payload.visitedAt, details);

  if (details.length > 0) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'Review payload is invalid.', details);
  }

  return {
    restaurantId,
    branchId,
    foodRating: ratings.foodRating,
    priceRating: ratings.priceRating,
    serviceRating: ratings.serviceRating,
    ambienceRating: ratings.ambienceRating,
    comment,
    visitedAt,
  };
}

async function assertUserCanReview(client, userId) {
  const result = await client.query(
    `SELECT id, status, review_restricted_until
     FROM users
     WHERE id = $1
     FOR SHARE`,
    [userId],
  );

  if (result.rowCount === 0) {
    throw createHttpError(401, 'AUTH_REQUIRED', 'Authenticated user does not exist.');
  }

  const user = result.rows[0];
  if (user.status === 'SUSPENDED') {
    throw createHttpError(403, 'ACCOUNT_SUSPENDED', 'Account is suspended.');
  }
  if (user.status === 'DELETED') {
    throw createHttpError(403, 'ACCOUNT_DELETED', 'Account is deleted.');
  }
  if (user.review_restricted_until && new Date(user.review_restricted_until).getTime() > Date.now()) {
    throw createHttpError(403, 'FORBIDDEN', 'User is temporarily restricted from writing reviews.');
  }
}

async function getActiveRestaurant(client, restaurantId) {
  const result = await client.query(
    `SELECT id, status
     FROM restaurants
     WHERE id = $1
       AND is_deleted = FALSE
     FOR SHARE`,
    [restaurantId],
  );

  if (result.rowCount === 0) {
    throw createHttpError(404, 'NOT_FOUND', 'Restaurant not found.');
  }

  if (result.rows[0].status !== 'ACTIVE') {
    throw createHttpError(422, 'RESTAURANT_NOT_ACTIVE', 'Restaurant is not active.');
  }

  return result.rows[0];
}

async function assertBranchBelongsToRestaurant(client, branchId, restaurantId) {
  if (!branchId) return;

  const result = await client.query(
    `SELECT id, status
     FROM restaurant_branches
     WHERE id = $1
       AND parent_restaurant_id = $2
     FOR SHARE`,
    [branchId, restaurantId],
  );

  if (result.rowCount === 0) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'branchId must belong to the restaurant.', [
      validationDetail('branchId', 'INVALID_BRANCH', 'branchId must belong to the restaurant.'),
    ]);
  }

  if (result.rows[0].status !== 'ACTIVE') {
    throw createHttpError(422, 'VALIDATION_ERROR', 'Branch is not active.', [
      validationDetail('branchId', 'BRANCH_NOT_ACTIVE', 'Branch must be ACTIVE.'),
    ]);
  }
}

async function assertNotOwnRestaurant(client, userId, restaurantId) {
  const result = await client.query(
    `SELECT 1
     FROM merchants m
     JOIN restaurant_merchants rm ON rm.merchant_id = m.id
     WHERE m.user_id = $1
       AND rm.restaurant_id = $2
       AND m.status = 'ACTIVE'
       AND rm.status = 'ACTIVE'
     LIMIT 1`,
    [userId, restaurantId],
  );

  if (result.rowCount > 0) {
    throw createHttpError(403, 'FORBIDDEN', 'Merchants cannot review their own restaurant.');
  }
}

export async function createReviewForVerificationIntent({ userId, payload }) {
  const data = validateCreateReviewPayload(payload);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await assertUserCanReview(client, userId);
    await getActiveRestaurant(client, data.restaurantId);
    await assertBranchBelongsToRestaurant(client, data.branchId, data.restaurantId);
    await assertNotOwnRestaurant(client, userId, data.restaurantId);

    const result = await client.query(
      `INSERT INTO reviews (
         user_id,
         restaurant_id,
         branch_id,
         food_rating,
         price_rating,
         service_rating,
         ambience_rating,
         comment,
         status,
         verification_status,
         trust_label,
         public_visibility,
         trust_weight_bucket,
         visited_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
               'SUBMITTED', 'UNVERIFIED', 'PENDING_VERIFICATION',
               'PRIVATE_UNTIL_DECISION', 'NONE', $9)
       RETURNING id, status`,
      [
        userId,
        data.restaurantId,
        data.branchId,
        data.foodRating,
        data.priceRating,
        data.serviceRating,
        data.ambienceRating,
        data.comment,
        data.visitedAt,
      ],
    );

    await client.query('COMMIT');

    return {
      reviewId: result.rows[0].id,
      status: result.rows[0].status,
      nextStep: 'UPLOAD_RECEIPT',
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function skipReviewReceiptVerification({ userId, reviewId, reason }) {
  const details = [];
  assertUuid(reviewId, 'reviewId', details);
  if (reason !== 'USER_SKIPPED_RECEIPT') {
    details.push(validationDetail(
      'reason',
      'INVALID_VALUE',
      'reason must be USER_SKIPPED_RECEIPT.',
    ));
  }
  if (details.length > 0) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'Skip verification request is invalid.', details);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const reviewResult = await client.query(
      `SELECT
         id,
         restaurant_id AS "restaurantId",
         status,
         verification_status AS "verificationStatus",
         trust_label AS "trustLabel",
         public_visibility AS "publicVisibility",
         trust_weight_bucket AS "trustWeightBucket"
       FROM reviews
       WHERE id = $1
         AND user_id = $2
         AND status <> 'DELETED'
       FOR UPDATE`,
      [reviewId, userId],
    );

    if (reviewResult.rowCount === 0) {
      throw createHttpError(404, 'NOT_FOUND', 'Review not found.');
    }

    const review = reviewResult.rows[0];
    if (
      review.status === 'REFERENCE_ONLY'
      && review.verificationStatus === 'SKIPPED'
      && review.publicVisibility === 'PUBLIC'
    ) {
      // Repair aggregates created before automatic recomputation was wired.
      await recomputeRestaurantTrustScore(review.restaurantId, { client });
      await client.query('COMMIT');
      return {
        reviewId: review.id,
        status: review.status,
        verificationStatus: review.verificationStatus,
        trustLabel: review.trustLabel,
        publicVisibility: review.publicVisibility,
        trustWeightBucket: review.trustWeightBucket,
      };
    }

    if (review.status !== 'SUBMITTED' || review.verificationStatus !== 'UNVERIFIED') {
      throw createHttpError(
        409,
        'REVIEW_NOT_EDITABLE',
        'Receipt verification can no longer be skipped for this review.',
      );
    }

    const receiptResult = await client.query(
      `SELECT 1
       FROM receipt_verifications
       WHERE review_id = $1
       LIMIT 1`,
      [reviewId],
    );
    if (receiptResult.rowCount > 0) {
      throw createHttpError(
        409,
        'REVIEW_NOT_EDITABLE',
        'Receipt verification has already started for this review.',
      );
    }

    const updated = await client.query(
      `UPDATE reviews
       SET status = 'REFERENCE_ONLY',
           verification_status = 'SKIPPED',
           trust_label = 'REFERENCE_ONLY',
           public_visibility = 'PUBLIC',
           trust_weight_bucket = 'LOW',
           updated_at = NOW()
       WHERE id = $1
       RETURNING
         id,
         status,
         verification_status AS "verificationStatus",
         trust_label AS "trustLabel",
         public_visibility AS "publicVisibility",
         trust_weight_bucket AS "trustWeightBucket"`,
      [reviewId],
    );

    await recomputeRestaurantTrustScore(review.restaurantId, { client });
    await client.query('COMMIT');
    const result = updated.rows[0];
    return {
      reviewId: result.id,
      status: result.status,
      verificationStatus: result.verificationStatus,
      trustLabel: result.trustLabel,
      publicVisibility: result.publicVisibility,
      trustWeightBucket: result.trustWeightBucket,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getReviewVerificationStatus({ userId, reviewId }) {
  const details = [];
  assertUuid(reviewId, 'reviewId', details);
  if (details.length > 0) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'Review id is invalid.', details);
  }

  const result = await pool.query(
    `SELECT
       r.id AS "reviewId",
       r.restaurant_id AS "restaurantId",
       r.branch_id AS "branchId",
       r.status,
       r.verification_status AS "verificationStatus",
       r.trust_label AS "trustLabel",
       r.public_visibility AS "publicVisibility",
       r.trust_weight_bucket AS "trustWeightBucket",
       r.visited_at AS "visitedAt",
       r.created_at AS "createdAt",
       r.updated_at AS "updatedAt",
       rv.id AS "receiptVerificationId",
       rv.status AS "receiptStatus",
       rv.decision AS "receiptDecision",
       rv.decision_reason AS "receiptDecisionReason",
       rv.captured_at AS "receiptCapturedAt",
       rv.decided_at AS "receiptDecidedAt",
       rv.created_at AS "receiptCreatedAt",
       rv.updated_at AS "receiptUpdatedAt"
     FROM reviews r
     LEFT JOIN LATERAL (
       SELECT *
       FROM receipt_verifications
       WHERE review_id = r.id
       ORDER BY created_at DESC
       LIMIT 1
     ) rv ON true
     WHERE r.id = $1
       AND r.user_id = $2
       AND r.status <> 'DELETED'`,
    [reviewId, userId],
  );

  if (result.rowCount === 0) {
    throw createHttpError(404, 'NOT_FOUND', 'Review not found.');
  }

  return toVerificationStatus(result.rows[0]);
}

export async function listPublicReviewsByRestaurant(restaurantId, { status = 'ALL', page = 1, pageSize = 20 } = {}) {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeSize = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
  const offset = (safePage - 1) * safeSize;

  const params = [restaurantId];
  let statusCondition = "r.status IN ('VERIFIED', 'REFERENCE_ONLY')";

  if (status === 'VERIFIED') {
    statusCondition = "r.status = 'VERIFIED'";
  } else if (status === 'REFERENCE_ONLY') {
    statusCondition = "r.status = 'REFERENCE_ONLY'";
  }

  // HIDDEN, REJECTED, and DELETED are excluded
  // Only public visibility reviews should be listed
  const whereClause = `WHERE r.restaurant_id = $1 AND ${statusCondition} AND r.public_visibility = 'PUBLIC'`;

  const dataQuery = `
    ${REVIEW_SELECT_PROJECTION}
    ${whereClause}
    ORDER BY r.created_at DESC
    LIMIT $2 OFFSET $3
  `;

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM reviews r
    JOIN users u ON u.id = r.user_id
    ${whereClause}
  `;

  const [dataResult, countResult] = await Promise.all([
    pool.query(dataQuery, [...params, safeSize, offset]),
    pool.query(countQuery, params),
  ]);

  const items = await Promise.all(
    dataResult.rows.map(async (row) => toPublicReview(
      row,
      await avatarUploadService.resolveReadUrl(row.reviewerAvatarReference),
    )),
  );

  return {
    items,
    page: safePage,
    pageSize: safeSize,
    total: parseInt(countResult.rows[0].total, 10),
  };
}
