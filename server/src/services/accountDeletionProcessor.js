import crypto from 'node:crypto';

import { pool } from '../config/db.js';
import { cognitoIdentityProvider } from './identityProviders/cognitoProvider.js';
import { s3ObjectStorage } from './objectStorage.js';

const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 100;
const MAX_CLEANUP_ATTEMPTS = 5;
const COMPLETION_RETAINED_DATA_REASON = 'security audit minimum; fraud minimum; retained Cognito subject deny mapping and audit/fraud references';

const clampBatchSize = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_BATCH_SIZE;
  }
  return Math.min(parsed, MAX_BATCH_SIZE);
};

const sha256Hex = (value) => crypto.createHash('sha256').update(value).digest('hex');

const createDeletedPhoneTombstone = (userId) => `+000${sha256Hex(`trustbite-deleted-phone:${userId}`).slice(-16)}`;

const createDeletedSecretTombstone = (prefix, id) => `deleted:${prefix}:${id}`;

const mapRequestResult = (requestId, status, details = {}) => ({
  requestId,
  status,
  ...details,
});

const selectDueRequest = async (client, excludedRequestIds = []) => {
  const result = await client.query(
    `SELECT
        adr.id AS request_id,
        adr.status AS request_status,
        adr.user_id,
        adr.legal_hold,
        adr.legal_hold_reason,
        u.phone_number,
        u.cognito_sub,
        u.avatar_url
     FROM account_deletion_requests adr
      JOIN users u ON u.id = adr.user_id
      WHERE adr.status IN ('REQUESTED', 'PROCESSING')
        AND (adr.scheduled_deletion_at IS NULL OR adr.scheduled_deletion_at <= now())
        AND (adr.legal_hold = false OR adr.cleanup_state <> 'LEGAL_HOLD')
        AND adr.cleanup_attempts < $2
        AND adr.id <> ALL($1::uuid[])
      ORDER BY adr.requested_at ASC
      LIMIT 1
     FOR UPDATE OF adr, u SKIP LOCKED`,
    [excludedRequestIds, MAX_CLEANUP_ATTEMPTS],
  );

  return result.rows[0] ?? null;
};

const acquireRequestLock = async (client, requestId) => {
  const result = await client.query(
    `SELECT pg_try_advisory_lock(hashtextextended('account_deletion:' || $1::text, 0)) AS locked`,
    [requestId],
  );

  return result.rows[0]?.locked === true;
};

const releaseRequestLock = async (client, requestId) => {
  await client.query(
    `SELECT pg_advisory_unlock(hashtextextended('account_deletion:' || $1::text, 0))`,
    [requestId],
  );
};

const claimDeletionRequest = async (client, request) => {
  const startedProcessing = request.request_status === 'REQUESTED';

  if (request.request_status === 'REQUESTED') {
    await client.query(
      `UPDATE account_deletion_requests
       SET status = 'PROCESSING',
           cleanup_state = 'CLEANUP_IN_PROGRESS',
           cleanup_attempts = cleanup_attempts + 1,
           cleanup_lease_token = gen_random_uuid(),
           cleanup_lease_expires_at = now() + interval '15 minutes',
           updated_at = now()
       WHERE id = $1 AND status = 'REQUESTED'`,
      [request.request_id],
    );
  } else {
    await client.query(
      `UPDATE account_deletion_requests
       SET cleanup_state = 'CLEANUP_IN_PROGRESS',
           cleanup_attempts = cleanup_attempts + 1,
           cleanup_lease_token = gen_random_uuid(),
           cleanup_lease_expires_at = now() + interval '15 minutes',
           updated_at = now()
       WHERE id = $1 AND status = 'PROCESSING'`,
      [request.request_id],
    );
  }

  await client.query(
    `UPDATE users
     SET status = 'DELETED',
         updated_at = now()
       WHERE id = $1`,
      [request.user_id],
    );

  if (startedProcessing) {
    await client.query(
      `INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, previous_status, new_status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        request.user_id,
        'SYSTEM',
        'ACCOUNT_DELETION_PROCESSING_STARTED',
        'ACCOUNT_DELETION_REQUEST',
        request.request_id,
        'REQUESTED',
        'PROCESSING',
        {
          cleanupState: 'CLEANUP_IN_PROGRESS',
          failClosedUserStatus: 'DELETED',
        },
      ],
    );
  }
};

const markLegalHoldSkipped = async (client, request) => {
  await client.query(
    `UPDATE account_deletion_requests
     SET cleanup_state = 'LEGAL_HOLD',
         cleanup_lease_token = NULL,
         cleanup_lease_expires_at = NULL,
         cleanup_last_error_code = NULL,
         cleanup_last_error_at = NULL,
         retained_data_reason = COALESCE(retained_data_reason, legal_hold_reason),
         updated_at = now()
     WHERE id = $1`,
    [request.request_id],
  );
};

const markCleanupRetryable = async (client, request, errorCode = 'EXTERNAL_CLEANUP_FAILED') => {
  await client.query(
    `UPDATE account_deletion_requests
     SET cleanup_state = 'RETRYABLE',
         cleanup_last_error_code = $2,
         cleanup_last_error_at = now(),
         cleanup_lease_token = NULL,
         cleanup_lease_expires_at = NULL,
         updated_at = now()
     WHERE id = $1`,
    [request.request_id, errorCode],
  );
};

const listObjectCleanupTargets = async (client, userId) => {
  const result = await client.query(
    `SELECT avatar_url AS url
       FROM users
      WHERE id = $1 AND avatar_url IS NOT NULL
     UNION ALL
     SELECT file_url AS url
       FROM receipt_verifications
      WHERE user_id = $1
     UNION ALL
     SELECT redacted_file_url AS url
       FROM receipt_verifications
      WHERE user_id = $1 AND redacted_file_url IS NOT NULL
     UNION ALL
     SELECT rm.url
       FROM review_media rm
       JOIN reviews r ON r.id = rm.review_id
      WHERE r.user_id = $1
     UNION ALL
     SELECT rc.evidence_url
       FROM restaurant_claims rc
       JOIN merchants m ON m.id = rc.merchant_id
      WHERE m.user_id = $1`,
    [userId],
  );

  return result.rows.map((row) => row.url);
};

const cleanupExternalResources = async (request, { identityProvider, objectStorage }) => {
  const providerResult = request.cognito_sub
    ? await identityProvider.deleteUser({ username: request.cognito_sub })
    : { skipped: true, reason: 'no_mapped_cognito_identity' };
  const objectResults = [];

  for (const url of request.objectUrls) {
    objectResults.push(await objectStorage.deleteOwnedObject(url));
  }

  return { providerResult, objectResults };
};

const recomputeAffectedRestaurantAggregates = async (client, userId) => {
  const result = await client.query(
    `WITH affected_restaurants AS (
       SELECT DISTINCT restaurant_id
       FROM reviews
       WHERE user_id = $1
     ),
     eligible_reviews AS (
        SELECT
          r.restaurant_id,
          r.status AS review_status,
          r.average_rating,
          CASE
            WHEN r.trust_weight_bucket IN ('FULL', 'HIGH') THEN 1.00
            WHEN r.trust_weight_bucket IN ('PARTIAL', 'LOW') THEN 0.25
           ELSE 0.00
         END AS trust_weight
        FROM reviews r
        JOIN affected_restaurants ar ON ar.restaurant_id = r.restaurant_id
        WHERE r.status IN ('VERIFIED', 'REFERENCE_ONLY')
          AND r.public_visibility = 'PUBLIC'
          AND r.trust_weight_bucket <> 'NONE'
     )
     UPDATE restaurants restaurant
     SET trust_score = (
           SELECT ROUND((SUM(er.average_rating * er.trust_weight) / NULLIF(SUM(er.trust_weight), 0))::numeric, 2)
           FROM eligible_reviews er
           WHERE er.restaurant_id = restaurant.id
             AND er.trust_weight > 0
         ),
         verified_review_count = (
           SELECT count(*)::int
            FROM eligible_reviews er
            WHERE er.restaurant_id = restaurant.id
              AND er.trust_weight > 0
              AND er.review_status = 'VERIFIED'
           ),
           reference_review_count = (
             SELECT count(*)::int
             FROM eligible_reviews er
             WHERE er.restaurant_id = restaurant.id
               AND er.trust_weight > 0
               AND er.review_status = 'REFERENCE_ONLY'
           ),
         updated_at = now()
     WHERE restaurant.id IN (SELECT restaurant_id FROM affected_restaurants)`,
    [userId],
  );

  return result.rowCount;
};

const completeDeletionRequest = async (client, request, cleanupResult) => {
  const phoneTombstone = createDeletedPhoneTombstone(request.user_id);
  const sessionResult = await client.query(
      `UPDATE user_sessions
       SET revoked_at = COALESCE(revoked_at, now()),
           refresh_token_hash = 'deleted-session-token-hash:' ||
             encode(digest('trustbite-deleted-session-token-hash:' || id::text, 'sha256'), 'hex'),
           device_label = NULL
       WHERE user_id = $1`,
      [request.user_id],
    );
    const pushResult = await client.query(
      `UPDATE push_tokens
       SET status = 'INACTIVE',
           token_ciphertext = 'deleted-push-token-ciphertext:' ||
             encode(digest('trustbite-deleted-push-token-ciphertext:' || id::text, 'sha256'), 'hex'),
           token_fingerprint = 'deleted-push-token-fingerprint:' ||
             encode(digest('trustbite-deleted-push-token-fingerprint:' || id::text, 'sha256'), 'hex')
       WHERE user_id = $1`,
      [request.user_id],
    );
    const otpResult = await client.query(
      `UPDATE otp_verifications
       SET phone_number = $2,
           otp_hash = $3,
           status = CASE WHEN status = 'VERIFIED' THEN 'VERIFIED' ELSE 'EXPIRED' END
     WHERE phone_number = $1`,
    [
      request.phone_number,
      phoneTombstone,
        createDeletedSecretTombstone('otp', request.user_id),
      ],
    );
    const userRolesResult = await client.query('DELETE FROM user_roles WHERE user_id = $1', [request.user_id]);
    const userBadgesResult = await client.query('DELETE FROM user_badges WHERE user_id = $1', [request.user_id]);
    const expTransactionsResult = await client.query('DELETE FROM exp_transactions WHERE user_id = $1', [request.user_id]);
    const savedListsResult = await client.query('DELETE FROM user_saved_lists WHERE user_id = $1', [request.user_id]);
    const followsResult = await client.query(
      'DELETE FROM user_follows WHERE follower_id = $1 OR following_id = $1',
      [request.user_id],
    );
    const blocksResult = await client.query(
      'DELETE FROM user_blocks WHERE blocker_user_id = $1 OR blocked_user_id = $1',
      [request.user_id],
    );
    const idempotencyResult = await client.query('DELETE FROM idempotency_keys WHERE user_id = $1', [request.user_id]);
    const notificationsResult = await client.query('DELETE FROM notifications WHERE recipient_user_id = $1', [request.user_id]);

      await client.query(
        `UPDATE reviews
         SET status = 'DELETED',
          food_rating = 3,
          price_rating = 3,
          service_rating = 3,
          ambience_rating = 3,
          verification_status = 'DELETED',
           public_visibility = 'PRIVATE',
           trust_weight_bucket = 'NONE',
           trust_label = 'DELETED',
           comment = 'Deleted account review',
          visited_at = NULL,
           hidden_reason = COALESCE(hidden_reason, 'account deleted'),
           updated_at = now()
       WHERE user_id = $1`,
        [request.user_id],
      );
    const reviewTagsResult = await client.query(
      `DELETE FROM review_tags
       WHERE review_id IN (SELECT id FROM reviews WHERE user_id = $1)`,
      [request.user_id],
    );
    const reviewVotesResult = await client.query(
      `DELETE FROM review_votes
       WHERE user_id = $1 OR review_id IN (SELECT id FROM reviews WHERE user_id = $1)`,
      [request.user_id],
    );
    const moderationReportsResult = await client.query(
      `UPDATE moderation_reports
       SET description = NULL,
           updated_at = now()
       WHERE reporter_id = $1
          OR (entity_type = 'USER' AND entity_id = $1)
          OR (entity_type = 'REVIEW' AND entity_id IN (SELECT id FROM reviews WHERE user_id = $1))`,
      [request.user_id],
    );
    const moderationActionsResult = await client.query(
      `UPDATE moderation_actions
       SET reason = 'Deleted account moderation action'
       WHERE admin_id = $1
          OR (entity_type = 'USER' AND entity_id = $1)
          OR (entity_type = 'REVIEW' AND entity_id IN (SELECT id FROM reviews WHERE user_id = $1))
          OR report_id IN (
            SELECT id
            FROM moderation_reports
            WHERE reporter_id = $1
               OR (entity_type = 'USER' AND entity_id = $1)
               OR (entity_type = 'REVIEW' AND entity_id IN (SELECT id FROM reviews WHERE user_id = $1))
          )`,
      [request.user_id],
    );
    const adminAssignmentsResult = await client.query(
      `UPDATE admin_queue_assignments
       SET resolved_at = COALESCE(resolved_at, now())
       WHERE admin_user_id = $1`,
      [request.user_id],
    );
    const minimizedAuditResult = await client.query(
      `UPDATE audit_logs
       SET reason = NULL,
           metadata = CASE
             WHEN metadata IS NULL THEN NULL
             ELSE jsonb_build_object('retainedDataReason', 'account deletion audit minimum')
           END
       WHERE actor_id = $1
          OR (entity_type = 'USER' AND entity_id = $1)
          OR (entity_type = 'REVIEW' AND entity_id IN (SELECT id FROM reviews WHERE user_id = $1))
          OR (entity_type = 'RECEIPT_VERIFICATION' AND entity_id IN (
            SELECT id FROM receipt_verifications WHERE user_id = $1
          ))`,
      [request.user_id],
    );
    const priceHistoryResult = await client.query(
      `UPDATE price_history
       SET review_id = NULL
       WHERE review_id IN (SELECT id FROM reviews WHERE user_id = $1)`,
      [request.user_id],
    );
    const reviewSummariesResult = await client.query(
      `DELETE FROM review_summaries
       WHERE restaurant_id IN (SELECT DISTINCT restaurant_id FROM reviews WHERE user_id = $1)`,
      [request.user_id],
    );
    const restaurantAggregateCount = await recomputeAffectedRestaurantAggregates(client, request.user_id);
    // Keep only previously verified transaction hashes as fraud-minimum evidence
    // so deleted verified receipts still block replay of the same transaction.
    await client.query(
      `UPDATE receipt_verifications
          SET file_url = 'deleted:receipt-file:' || id::text,
          file_hash_sha256 = encode(digest('trustbite-deleted-receipt-file-hash:' || id::text, 'sha256'), 'hex'),
          transaction_unique_hash = CASE
            WHEN status = 'VERIFIED' THEN transaction_unique_hash
            ELSE NULL
          END,
          redacted_file_url = CASE
            WHEN redacted_file_url IS NULL THEN NULL
            ELSE 'deleted:receipt-redacted:' || id::text
          END,
          status = 'DELETED',
          ocr_text = NULL,
          ocr_restaurant_name = NULL,
          ocr_similarity = NULL,
          ocr_receipt_time = NULL,
          ocr_invoice_no = NULL,
          ocr_total_amount = NULL,
          gps_latitude = NULL,
          gps_longitude = NULL,
          gps_accuracy_meters = NULL,
          gps_distance_meters = NULL,
          fraud_risk_score = 0,
          decision = NULL,
          decision_reason = NULL,
          decided_by = NULL,
           updated_at = now()
       WHERE user_id = $1`,
      [request.user_id],
    );
      const receiptDeciderRefsResult = await client.query(
        `UPDATE receipt_verifications
         SET decided_by = NULL,
             updated_at = now()
         WHERE decided_by = $1`,
        [request.user_id],
      );
    const receiptLineItemMenuMapsResult = await client.query(
      `DELETE FROM receipt_line_item_menu_maps
       WHERE receipt_line_item_id IN (
         SELECT item.id
         FROM receipt_line_items item
         JOIN receipt_verifications receipt ON receipt.id = item.receipt_verification_id
         WHERE receipt.user_id = $1
       )`,
      [request.user_id],
    );
    await client.query(
      `UPDATE receipt_line_items
       SET raw_item_name = 'Deleted receipt item',
           quantity = 1.00,
         unit_price = 0.00,
         total_price = 0.00
     WHERE receipt_verification_id IN (
       SELECT id FROM receipt_verifications WHERE user_id = $1
     )`,
    [request.user_id],
  );
  await client.query(
    `UPDATE review_media
     SET status = 'INACTIVE',
         url = 'deleted:review-media:' || id::text
       WHERE review_id IN (SELECT id FROM reviews WHERE user_id = $1)`,
      [request.user_id],
    );
    const reviewRepliesResult = await client.query(
      `UPDATE review_replies
       SET status = 'HIDDEN',
           message = 'Deleted account reply',
           updated_at = now()
       WHERE review_id IN (SELECT id FROM reviews WHERE user_id = $1)
          OR merchant_id IN (SELECT id FROM merchants WHERE user_id = $1)`,
      [request.user_id],
    );
    await client.query(
      `UPDATE merchants
       SET status = 'SUSPENDED',
         business_name = 'Deleted merchant',
         updated_at = now()
     WHERE user_id = $1`,
    [request.user_id],
  );
  await client.query(
    `UPDATE restaurant_merchants
     SET status = 'INACTIVE'
     WHERE merchant_id IN (SELECT id FROM merchants WHERE user_id = $1)`,
    [request.user_id],
  );
    await client.query(
      `UPDATE restaurant_claims
       SET evidence_url = 'deleted:claim-evidence:' || id::text,
           admin_note = NULL,
           decided_by = NULL,
           updated_at = now()
       WHERE merchant_id IN (SELECT id FROM merchants WHERE user_id = $1)`,
      [request.user_id],
    );
    const claimDeciderRefsResult = await client.query(
      `UPDATE restaurant_claims
       SET decided_by = NULL,
           updated_at = now()
       WHERE decided_by = $1`,
      [request.user_id],
    );
  await client.query(
    `UPDATE users
     SET phone_number = $2,
           display_name = NULL,
           avatar_url = NULL,
           status = 'DELETED',
           exp_points = 0,
           rank_code = 'NEWBIE',
           review_restricted_until = NULL,
           deletion_requested_at = NULL,
           deleted_at = COALESCE(deleted_at, now()),
         updated_at = now()
     WHERE id = $1`,
    [request.user_id, phoneTombstone],
  );
    await client.query(
      `UPDATE account_deletion_requests
       SET status = 'COMPLETED',
           reason = NULL,
           completed_at = COALESCE(completed_at, now()),
           cleanup_state = 'COMPLETED',
           cleanup_last_error_code = NULL,
           cleanup_last_error_at = NULL,
           cleanup_lease_token = NULL,
           cleanup_lease_expires_at = NULL,
           retained_data_reason = COALESCE(retained_data_reason, $2),
           updated_at = now()
       WHERE id = $1`,
    [request.request_id, COMPLETION_RETAINED_DATA_REASON],
  );
  await client.query(
    `INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, previous_status, new_status, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      request.user_id,
      'SYSTEM',
      'ACCOUNT_DELETION_COMPLETED',
        'ACCOUNT_DELETION_REQUEST',
        request.request_id,
        'PROCESSING',
        'COMPLETED',
        {
        anonymizedCoreProfile: true,
        providerCleanup: cleanupResult.providerResult,
        ownedObjectUrlsProcessed: cleanupResult.objectResults.length,
        ownedObjectsDeleted: cleanupResult.objectResults.filter((result) => result.deleted).length,
          retainedCognitoSub: Boolean(request.cognito_sub),
          revokedSessions: sessionResult.rowCount,
          inactivatedPushTokens: pushResult.rowCount,
          anonymizedOtpRows: otpResult.rowCount,
          removedRelationshipRows: {
            userRoles: userRolesResult.rowCount,
            userBadges: userBadgesResult.rowCount,
            expTransactions: expTransactionsResult.rowCount,
            savedLists: savedListsResult.rowCount,
            follows: followsResult.rowCount,
            blocks: blocksResult.rowCount,
            reviewTags: reviewTagsResult.rowCount,
            reviewVotes: reviewVotesResult.rowCount,
          },
          removedSystemRows: {
            notifications: notificationsResult.rowCount,
            idempotencyKeys: idempotencyResult.rowCount,
          },
          detachedPriceHistoryRows: priceHistoryResult.rowCount,
          invalidatedReviewSummaries: reviewSummariesResult.rowCount,
          recomputedRestaurantAggregates: restaurantAggregateCount,
          minimizedModerationReports: moderationReportsResult.rowCount,
            minimizedModerationActions: moderationActionsResult.rowCount,
            resolvedAdminQueueAssignments: adminAssignmentsResult.rowCount,
            minimizedAuditRows: minimizedAuditResult.rowCount,
              clearedReceiptDeciderRefs: receiptDeciderRefsResult.rowCount,
              removedReceiptLineItemMenuMaps: receiptLineItemMenuMapsResult.rowCount,
              clearedClaimDeciderRefs: claimDeciderRefsResult.rowCount,
              anonymizedReviewReplies: reviewRepliesResult.rowCount,
            },
        ],
    );
};

const processOneDueAccountDeletion = async ({
  identityProvider,
  objectStorage,
  excludedRequestIds = [],
}) => {
  const client = await pool.connect();
  let request = null;
  let lockAcquired = false;
  try {
    await client.query('BEGIN');
    request = await selectDueRequest(client, excludedRequestIds);
      if (!request) {
        await client.query('COMMIT');
        return null;
      }

      if (request.legal_hold) {
        await markLegalHoldSkipped(client, request);
        await client.query('COMMIT');
        return mapRequestResult(request.request_id, 'SKIPPED', {
          userId: request.user_id,
          reason: 'legal_hold',
        });
      }

      lockAcquired = await acquireRequestLock(client, request.request_id);
      if (!lockAcquired) {
      await client.query('ROLLBACK');
      return mapRequestResult(request.request_id, 'SKIPPED', {
        userId: request.user_id,
        reason: 'lock_busy',
      });
    }

      try {
        await claimDeletionRequest(client, request);
        request.objectUrls = await listObjectCleanupTargets(client, request.user_id);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        return mapRequestResult(request.request_id, 'FAILED', {
          userId: request.user_id,
          reason: 'claim_persistence_failed',
          errorName: err?.name || 'Error',
        });
      }

    let cleanupResult;
      try {
        cleanupResult = await cleanupExternalResources(request, { identityProvider, objectStorage });
      } catch (err) {
        await client.query('BEGIN');
        await markCleanupRetryable(client, request);
        await client.query('COMMIT');
        return mapRequestResult(request.request_id, 'FAILED', {
          userId: request.user_id,
          reason: 'external_cleanup_failed',
        errorName: err?.name || 'Error',
      });
    }

      try {
        await client.query('BEGIN');
        await completeDeletionRequest(client, request, cleanupResult);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        try {
          await client.query('BEGIN');
          await markCleanupRetryable(client, request, 'COMPLETION_PERSISTENCE_FAILED');
          await client.query('COMMIT');
        } catch (retryErr) {
          await client.query('ROLLBACK');
          throw retryErr;
        }
        return mapRequestResult(request.request_id, 'FAILED', {
          userId: request.user_id,
          reason: 'completion_persistence_failed',
          errorName: err?.name || 'Error',
        });
      }
      return mapRequestResult(request.request_id, 'COMPLETED', { userId: request.user_id });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    try {
      if (lockAcquired && request) {
        await releaseRequestLock(client, request.request_id);
      }
    } finally {
      client.release();
    }
  }
};

export async function processDueAccountDeletions({
  batchSize = DEFAULT_BATCH_SIZE,
  identityProvider = cognitoIdentityProvider,
  objectStorage = s3ObjectStorage,
} = {}) {
  const limit = clampBatchSize(batchSize);
  const results = [];
  const skippedRequestIds = [];

  for (let index = 0; index < limit; index += 1) {
    const result = await processOneDueAccountDeletion({
      identityProvider,
      objectStorage,
      excludedRequestIds: skippedRequestIds,
    });
    if (!result) {
      break;
    }
    results.push(result);
    if (result.status === 'SKIPPED' || result.status === 'FAILED') {
      skippedRequestIds.push(result.requestId);
    }
  }

  return {
    processed: results.length,
    completed: results.filter((result) => result.status === 'COMPLETED').length,
    skipped: results.filter((result) => result.status === 'SKIPPED').length,
    failed: results.filter((result) => result.status === 'FAILED').length,
    results,
  };
}
