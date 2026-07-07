import '../helpers/env.js';
import crypto from 'node:crypto';
import { afterAll, describe, expect, it, vi } from 'vitest';

const { createRestaurant, createReview, createUser } = await import('../helpers/factories/index.js');
const { closeDbPool, query } = await import('../helpers/db.js');
const { pool } = await import('../../src/config/db.js');
const { authService } = await import('../../src/services/auth.js');
const { CognitoIdentityProvider } = await import('../../src/services/identityProviders/cognitoProvider.js');
const { processDueAccountDeletions } = await import('../../src/services/accountDeletionProcessor.js');
const { S3ObjectStorage } = await import('../../src/services/objectStorage.js');

async function cleanupUser(userId) {
  await query('DELETE FROM audit_logs WHERE actor_id = $1 OR entity_id IN (SELECT id FROM account_deletion_requests WHERE user_id = $1)', [userId]);
  await query('DELETE FROM account_deletion_requests WHERE user_id = $1', [userId]);
  await query('DELETE FROM notification_delivery_logs WHERE push_token_id IN (SELECT id FROM push_tokens WHERE user_id = $1)', [userId]);
  await query('DELETE FROM notifications WHERE recipient_user_id = $1', [userId]);
  await query('DELETE FROM idempotency_keys WHERE user_id = $1', [userId]);
  await query('DELETE FROM push_tokens WHERE user_id = $1', [userId]);
  await query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);
      await query('DELETE FROM otp_verifications WHERE phone_number LIKE $1', ['+000%']);
  await query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
  await query('DELETE FROM user_badges WHERE user_id = $1', [userId]);
  await query('DELETE FROM exp_transactions WHERE user_id = $1', [userId]);
  await query('DELETE FROM user_saved_lists WHERE user_id = $1', [userId]);
  await query('DELETE FROM user_follows WHERE follower_id = $1 OR following_id = $1', [userId]);
  await query('DELETE FROM user_blocks WHERE blocker_user_id = $1 OR blocked_user_id = $1', [userId]);
  await query('DELETE FROM review_votes WHERE user_id = $1 OR review_id IN (SELECT id FROM reviews WHERE user_id = $1)', [userId]);
  await query('DELETE FROM review_tags WHERE review_id IN (SELECT id FROM reviews WHERE user_id = $1)', [userId]);
  await query('DELETE FROM review_replies WHERE review_id IN (SELECT id FROM reviews WHERE user_id = $1)', [userId]);
  await query('DELETE FROM review_replies WHERE merchant_id IN (SELECT id FROM merchants WHERE user_id = $1)', [userId]);
  await query('DELETE FROM admin_queue_assignments WHERE admin_user_id = $1', [userId]);
  await query('DELETE FROM admin_queues WHERE entity_id = $1 OR entity_id IN (SELECT id FROM reviews WHERE user_id = $1)', [userId]);
  await query('DELETE FROM moderation_actions WHERE admin_id = $1 OR entity_id = $1 OR entity_id IN (SELECT id FROM reviews WHERE user_id = $1)', [userId]);
  await query('DELETE FROM moderation_actions WHERE report_id IN (SELECT id FROM moderation_reports WHERE reporter_id = $1 OR entity_id = $1 OR entity_id IN (SELECT id FROM reviews WHERE user_id = $1))', [userId]);
  await query('DELETE FROM moderation_reports WHERE reporter_id = $1 OR entity_id = $1 OR entity_id IN (SELECT id FROM reviews WHERE user_id = $1)', [userId]);
  await query(
    `DELETE FROM fraud_flag_entities
     WHERE entity_id = $1
        OR entity_id IN (SELECT id FROM reviews WHERE user_id = $1)
        OR entity_id IN (SELECT id FROM receipt_verifications WHERE user_id = $1)`,
    [userId],
  );
  await query('DELETE FROM fraud_flags WHERE id NOT IN (SELECT fraud_flag_id FROM fraud_flag_entities)', []);
  await query('DELETE FROM restaurant_claims WHERE merchant_id IN (SELECT id FROM merchants WHERE user_id = $1)', [userId]);
  await query('DELETE FROM restaurant_merchants WHERE merchant_id IN (SELECT id FROM merchants WHERE user_id = $1)', [userId]);
  await query('DELETE FROM merchants WHERE user_id = $1', [userId]);
  await query('DELETE FROM receipt_line_items WHERE receipt_verification_id IN (SELECT id FROM receipt_verifications WHERE user_id = $1)', [userId]);
  await query('DELETE FROM receipt_verifications WHERE user_id = $1', [userId]);
  await query('DELETE FROM review_media WHERE review_id IN (SELECT id FROM reviews WHERE user_id = $1)', [userId]);
  await query('DELETE FROM reviews WHERE user_id = $1', [userId]);
  await query('DELETE FROM users WHERE id = $1', [userId]);
}

async function installAccountDeletionFailureTrigger({ requestId, mode }) {
  const suffix = `${mode}_${requestId.replace(/-/g, '_')}`;
  const functionName = `privacy_test_fail_deletion_${suffix}`;
  const triggerName = `privacy_test_fail_deletion_${suffix}_trigger`;
  const escapedRequestId = requestId.replace(/'/g, "''");

  await query(
    `CREATE OR REPLACE FUNCTION ${functionName}()
     RETURNS trigger AS $$
     BEGIN
       IF NEW.id::text = '${escapedRequestId}'
          AND '${mode}' = 'claim'
          AND OLD.status = 'REQUESTED'
          AND NEW.status = 'PROCESSING' THEN
         RAISE EXCEPTION 'privacy test claim persistence failure';
       END IF;

       IF NEW.id::text = '${escapedRequestId}'
          AND '${mode}' = 'completion'
          AND OLD.status = 'PROCESSING'
          AND NEW.status = 'COMPLETED' THEN
         RAISE EXCEPTION 'privacy test completion persistence failure';
       END IF;

       RETURN NEW;
     END;
     $$ LANGUAGE plpgsql`,
  );
  await query(
    `CREATE TRIGGER ${triggerName}
     BEFORE UPDATE ON account_deletion_requests
     FOR EACH ROW
     EXECUTE FUNCTION ${functionName}()`,
  );

  return async () => {
    await query(`DROP TRIGGER IF EXISTS ${triggerName} ON account_deletion_requests`);
    await query(`DROP FUNCTION IF EXISTS ${functionName}()`);
  };
}

class InMemoryCognitoAdminClient {
  constructor(usernames) {
    this.users = new Set(usernames);
    this.calls = [];
  }

  async send(command) {
    this.calls.push({
      commandName: command.constructor.name,
      input: command.input,
    });

    if (!this.users.has(command.input.Username)) {
      throw Object.assign(new Error('user not found'), { name: 'UserNotFoundException' });
    }

    if (command.constructor.name === 'AdminDeleteUserCommand') {
      this.users.delete(command.input.Username);
    }

    return {};
  }
}

describe('account deletion processor', () => {
  afterAll(async () => {
    await closeDbPool();
  });

  it('completes a due deletion request, anonymizes core user PII, and leaves the account fail-closed', async () => {
    const user = await createUser({ displayName: 'Delete Processor Target' });
    const restaurant = await createRestaurant();
    const review = await createReview({ userId: user.id, restaurantId: restaurant.id });
    const cognitoSub = `processor-sub-${user.id}`;
    await query(
      `UPDATE users
       SET cognito_sub = $2, avatar_url = $3
       WHERE id = $1`,
      [user.id, cognitoSub, 's3://trustbite-invoices/avatars/delete-me.png'],
    );
    await query(
      `INSERT INTO receipt_verifications (
         review_id, user_id, restaurant_id, file_url, file_hash_sha256, redacted_file_url,
         ocr_text, ocr_restaurant_name, ocr_invoice_no, ocr_total_amount,
         gps_latitude, gps_longitude, gps_accuracy_meters, gps_distance_meters,
         decision_reason
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id`,
      [
        review.id,
        user.id,
        restaurant.id,
        's3://trustbite-invoices/receipts/raw-receipt.png',
        'a'.repeat(64),
        's3://trustbite-invoices/receipts/redacted-receipt.png',
        'raw receipt text',
        'Restaurant PII',
        'INV-1',
        100_000,
        10.1234567,
        106.1234567,
        8,
        12,
        'raw decision reason',
      ],
    );
      await query(
        `INSERT INTO receipt_line_items (receipt_verification_id, raw_item_name, quantity, unit_price, total_price)
         SELECT id, $2, $3, $4, $5
         FROM receipt_verifications
         WHERE user_id = $1`,
        [user.id, 'Sensitive food item', 2, 10_000, 20_000],
      );
      const mappedMenuItem = await query(
        `INSERT INTO menu_items (restaurant_id, name, price_default)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [restaurant.id, 'Sensitive mapped menu item', 10000],
      );
      await query(
        `INSERT INTO receipt_line_item_menu_maps (receipt_line_item_id, menu_item_id, confidence_score)
         SELECT item.id, $2, $3
         FROM receipt_line_items item
         JOIN receipt_verifications receipt ON receipt.id = item.receipt_verification_id
         WHERE receipt.user_id = $1`,
        [user.id, mappedMenuItem.rows[0].id, 98.50],
      );
      await query(
        `INSERT INTO review_media (review_id, media_type, url, mime_type)
         VALUES ($1, $2, $3, $4)`,
      [review.id, 'IMAGE', 's3://trustbite-invoices/review-media/review-photo.png', 'image/png'],
    );
    const merchant = await query(
      `INSERT INTO merchants (user_id, business_name, status)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [user.id, 'Personal Merchant Name', 'ACTIVE'],
    );
    await query(
      `INSERT INTO restaurant_merchants (restaurant_id, merchant_id, permission_level, status)
       VALUES ($1, $2, $3, $4)`,
      [restaurant.id, merchant.rows[0].id, 'OWNER', 'ACTIVE'],
    );
    await query(
      `INSERT INTO restaurant_claims (merchant_id, restaurant_id, status, evidence_url, admin_note)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        merchant.rows[0].id,
        restaurant.id,
        'SUBMITTED',
        's3://trustbite-invoices/merchant-claims/claim-evidence.png',
        'sensitive admin note',
      ],
    );
    await query(
      `INSERT INTO user_sessions (user_id, refresh_token_hash, device_label, platform, expires_at)
       VALUES ($1, $2, $3, $4, now() + interval '1 day')`,
      [user.id, `session-${user.id}`, 'phone', 'IOS'],
    );
    await query(
      `INSERT INTO push_tokens (user_id, platform, token_ciphertext, token_fingerprint, provider)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, 'IOS', `ciphertext-${user.id}`, `fingerprint-${user.id}`, 'APNS'],
    );
    await query(
      `INSERT INTO push_tokens (user_id, platform, token_ciphertext, token_fingerprint, provider)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, 'ANDROID', `ciphertext-2-${user.id}`, `fingerprint-2-${user.id}`, 'FCM'],
    );
    const deletionRequest = await query(
      `INSERT INTO account_deletion_requests (user_id, reason, scheduled_deletion_at)
       VALUES ($1, $2, now() - interval '1 minute')
       RETURNING id`,
      [user.id, 'Sensitive deletion reason'],
    );
    const identityProvider = {
      deleteUser: vi.fn().mockResolvedValue({ deleted: true, signedOut: true }),
    };
    const objectStorage = {
      deleteOwnedObject: vi.fn().mockResolvedValue({ deleted: true }),
    };

    try {
      const result = await processDueAccountDeletions({
        batchSize: 5,
        identityProvider,
        objectStorage,
      });

      expect(result).toMatchObject({
        processed: 1,
        completed: 1,
        skipped: 0,
        failed: 0,
      });

      const persisted = await query(
          `SELECT
             u.phone_number,
           u.display_name,
           u.avatar_url,
           u.status AS user_status,
           u.deleted_at,
           u.deletion_requested_at,
           u.cognito_sub,
             adr.status AS request_status,
             adr.reason AS request_reason,
             adr.completed_at,
             adr.retained_data_reason,
             s.id AS session_id,
             s.refresh_token_hash,
             s.revoked_at,
             a.reason AS audit_reason,
             a.previous_status AS audit_previous_status,
             a.new_status AS audit_new_status,
             a.metadata
           FROM users u
         JOIN account_deletion_requests adr ON adr.user_id = u.id
         JOIN user_sessions s ON s.user_id = u.id
         JOIN audit_logs a ON a.entity_id = adr.id AND a.action = 'ACCOUNT_DELETION_COMPLETED'
         WHERE u.id = $1`,
        [user.id],
      );
      const pushTokens = await query(
          `SELECT id, status, token_ciphertext, token_fingerprint
           FROM push_tokens
           WHERE user_id = $1
           ORDER BY platform`,
        [user.id],
      );
      const contentRows = await query(
        `SELECT
           r.comment,
           rv.file_url,
           rv.redacted_file_url,
           rv.ocr_text,
           li.raw_item_name,
           rm.url AS media_url,
           m.business_name,
           m.status AS merchant_status,
           rma.status AS merchant_link_status,
           rc.evidence_url,
           rc.admin_note
         FROM reviews r
         JOIN receipt_verifications rv ON rv.review_id = r.id
         JOIN receipt_line_items li ON li.receipt_verification_id = rv.id
         JOIN review_media rm ON rm.review_id = r.id
         JOIN merchants m ON m.user_id = r.user_id
         JOIN restaurant_merchants rma ON rma.merchant_id = m.id
         JOIN restaurant_claims rc ON rc.merchant_id = m.id
         WHERE r.user_id = $1`,
        [user.id],
      );
      const remainingReceiptMenuMaps = await query(
        `SELECT count(*)::int AS count
         FROM receipt_line_item_menu_maps map
         JOIN receipt_line_items item ON item.id = map.receipt_line_item_id
         JOIN receipt_verifications receipt ON receipt.id = item.receipt_verification_id
         WHERE receipt.user_id = $1`,
        [user.id],
      );

      expect(persisted.rowCount).toBe(1);
      expect(identityProvider.deleteUser).toHaveBeenCalledWith({ username: cognitoSub });
      expect(objectStorage.deleteOwnedObject).toHaveBeenCalledTimes(5);
      expect(objectStorage.deleteOwnedObject).toHaveBeenCalledWith('s3://trustbite-invoices/avatars/delete-me.png');
      expect(objectStorage.deleteOwnedObject).toHaveBeenCalledWith('s3://trustbite-invoices/receipts/raw-receipt.png');
      expect(objectStorage.deleteOwnedObject).toHaveBeenCalledWith('s3://trustbite-invoices/receipts/redacted-receipt.png');
      expect(objectStorage.deleteOwnedObject).toHaveBeenCalledWith('s3://trustbite-invoices/review-media/review-photo.png');
      expect(objectStorage.deleteOwnedObject).toHaveBeenCalledWith('s3://trustbite-invoices/merchant-claims/claim-evidence.png');
      expect(persisted.rows[0].user_status).toBe('DELETED');
      expect(persisted.rows[0].deleted_at).toBeTruthy();
      expect(persisted.rows[0].deletion_requested_at).toBeNull();
        expect(persisted.rows[0].request_status).toBe('COMPLETED');
        expect(persisted.rows[0].request_reason).toBeNull();
        expect(persisted.rows[0].completed_at).toBeTruthy();
      expect(persisted.rows[0].retained_data_reason).toContain('security');
        const expectedPhoneTombstone = `+000${crypto
          .createHash('sha256')
          .update(`trustbite-deleted-phone:${user.id}`)
          .digest('hex')
          .slice(-16)}`;
        const expectedSessionHash = `deleted-session-token-hash:${crypto
          .createHash('sha256')
          .update(`trustbite-deleted-session-token-hash:${persisted.rows[0].session_id}`)
          .digest('hex')}`;
        expect(persisted.rows[0].phone_number).toBe(expectedPhoneTombstone);
        expect(persisted.rows[0].display_name).toBeNull();
        expect(persisted.rows[0].avatar_url).toBeNull();
        expect(persisted.rows[0].cognito_sub).toBe(cognitoSub);
        expect(persisted.rows[0].revoked_at).toBeTruthy();
        expect(persisted.rows[0].refresh_token_hash).toBe(expectedSessionHash);
        expect(pushTokens.rows).toHaveLength(2);
        for (const row of pushTokens.rows) {
          const expectedPushCiphertext = `deleted-push-token-ciphertext:${crypto
            .createHash('sha256')
            .update(`trustbite-deleted-push-token-ciphertext:${row.id}`)
            .digest('hex')}`;
          const expectedPushFingerprint = `deleted-push-token-fingerprint:${crypto
            .createHash('sha256')
            .update(`trustbite-deleted-push-token-fingerprint:${row.id}`)
            .digest('hex')}`;
          expect(row.status).toBe('INACTIVE');
          expect(row.token_ciphertext).toBe(expectedPushCiphertext);
          expect(row.token_fingerprint).toBe(expectedPushFingerprint);
        }
        expect(new Set(pushTokens.rows.map((row) => row.token_fingerprint)).size).toBe(2);
        expect(persisted.rows[0].audit_reason).toBeNull();
        expect(persisted.rows[0].audit_previous_status).toBe('PROCESSING');
        expect(persisted.rows[0].audit_new_status).toBe('COMPLETED');
        expect(persisted.rows[0].metadata).toMatchObject({
          anonymizedCoreProfile: true,
        providerCleanup: { deleted: true, signedOut: true },
        ownedObjectUrlsProcessed: 5,
        ownedObjectsDeleted: 5,
        retainedCognitoSub: true,
        inactivatedPushTokens: 2,
      });
      expect(contentRows.rowCount).toBe(1);
      expect(contentRows.rows[0]).toMatchObject({
        comment: 'Deleted account review',
        file_url: expect.stringMatching(/^deleted:receipt-file:/),
        redacted_file_url: expect.stringMatching(/^deleted:receipt-redacted:/),
        ocr_text: null,
        raw_item_name: 'Deleted receipt item',
        media_url: expect.stringMatching(/^deleted:review-media:/),
        business_name: 'Deleted merchant',
        merchant_status: 'SUSPENDED',
        merchant_link_status: 'INACTIVE',
        evidence_url: expect.stringMatching(/^deleted:claim-evidence:/),
        admin_note: null,
      });
      expect(remainingReceiptMenuMaps.rows[0].count).toBe(0);

      await expect(authService.mapIdentityToUser({
        provider: 'cognito',
        subject: cognitoSub,
        phoneNumber: null,
        phoneNumberVerified: false,
        tokenUse: 'access',
      })).rejects.toMatchObject({ statusCode: 403, code: 'ACCOUNT_DELETED' });
    } finally {
        await cleanupUser(user.id);
        await query('DELETE FROM restaurants WHERE id = $1', [restaurant.id]);
        }
      });

      it('completes deletion without Cognito cleanup when no provider identity is mapped', async () => {
        const user = await createUser({ displayName: 'Phone Only Deletion Target' });
        await query(
          `INSERT INTO account_deletion_requests (user_id, reason, scheduled_deletion_at)
           VALUES ($1, $2, now() - interval '1 minute')`,
          [user.id, 'Sensitive phone-only deletion reason'],
        );
        const identityProvider = {
          deleteUser: vi.fn().mockRejectedValue(new Error('Cognito cleanup should not be called')),
        };
        const objectStorage = {
          deleteOwnedObject: vi.fn().mockResolvedValue({ deleted: true }),
        };

        try {
          const result = await processDueAccountDeletions({
            batchSize: 1,
            identityProvider,
            objectStorage,
          });

          expect(result).toMatchObject({
            processed: 1,
            completed: 1,
            skipped: 0,
            failed: 0,
          });
          expect(identityProvider.deleteUser).not.toHaveBeenCalled();
          expect(objectStorage.deleteOwnedObject).not.toHaveBeenCalled();

          const persisted = await query(
            `SELECT u.status AS user_status,
                    u.cognito_sub,
                    u.deleted_at,
                    adr.status AS request_status,
                    adr.cleanup_state,
                    adr.cleanup_last_error_code,
                    adr.completed_at,
                    adr.reason AS request_reason,
                    a.metadata
               FROM users u
               JOIN account_deletion_requests adr ON adr.user_id = u.id
               JOIN audit_logs a ON a.entity_id = adr.id AND a.action = 'ACCOUNT_DELETION_COMPLETED'
              WHERE u.id = $1`,
            [user.id],
          );

          expect(persisted.rows[0]).toMatchObject({
            user_status: 'DELETED',
            cognito_sub: null,
            request_status: 'COMPLETED',
            cleanup_state: 'COMPLETED',
            cleanup_last_error_code: null,
            request_reason: null,
          });
          expect(persisted.rows[0].deleted_at).toBeTruthy();
          expect(persisted.rows[0].completed_at).toBeTruthy();
          expect(persisted.rows[0].metadata.providerCleanup).toMatchObject({
            skipped: true,
            reason: 'no_mapped_cognito_identity',
          });
          expect(persisted.rows[0].metadata.retainedCognitoSub).toBe(false);
        } finally {
          await cleanupUser(user.id);
        }
      });

      it('keeps the request retryable when Cognito cleanup rejects a mapped provider user', async () => {
        const user = await createUser({ displayName: 'Cognito Cleanup Failure Target' });
        const cognitoSub = `failing-provider-sub-${user.id}`;
        await query(
          `UPDATE users
           SET cognito_sub = $2
           WHERE id = $1`,
          [user.id, cognitoSub],
        );
        await query(
          `INSERT INTO account_deletion_requests (user_id, reason, scheduled_deletion_at)
           VALUES ($1, $2, now() - interval '1 minute')`,
          [user.id, 'Sensitive provider failure deletion reason'],
        );
        const objectStorage = {
          deleteOwnedObject: vi.fn().mockResolvedValue({ deleted: true }),
        };

        try {
          const result = await processDueAccountDeletions({
            batchSize: 1,
            identityProvider: {
              deleteUser: vi.fn().mockRejectedValue(Object.assign(new Error('provider unavailable'), {
                name: 'ProviderUnavailable',
              })),
            },
            objectStorage,
          });

          expect(result).toMatchObject({
            processed: 1,
            completed: 0,
            skipped: 0,
            failed: 1,
          });
          expect(result.results[0]).toMatchObject({
            status: 'FAILED',
            reason: 'external_cleanup_failed',
            errorName: 'ProviderUnavailable',
          });
          expect(objectStorage.deleteOwnedObject).not.toHaveBeenCalled();

          const persisted = await query(
            `SELECT u.status AS user_status,
                    u.cognito_sub,
                    u.deleted_at,
                    adr.status AS request_status,
                    adr.cleanup_state,
                    adr.cleanup_last_error_code,
                    adr.completed_at
               FROM users u
               JOIN account_deletion_requests adr ON adr.user_id = u.id
              WHERE u.id = $1`,
            [user.id],
          );

          expect(persisted.rows[0]).toMatchObject({
            user_status: 'DELETED',
            cognito_sub: cognitoSub,
            deleted_at: null,
            request_status: 'PROCESSING',
            cleanup_state: 'RETRYABLE',
            cleanup_last_error_code: 'EXTERNAL_CLEANUP_FAILED',
            completed_at: null,
          });
        } finally {
          await cleanupUser(user.id);
        }
      });

    it('rolls back claim state without external cleanup when the claim transaction fails', async () => {
      const user = await createUser({ displayName: 'Claim Rollback Target' });
      const cognitoSub = `claim-rollback-sub-${user.id}`;
      await query(
        `UPDATE users
         SET cognito_sub = $2
         WHERE id = $1`,
        [user.id, cognitoSub],
      );
      const deletionRequest = await query(
        `INSERT INTO account_deletion_requests (user_id, reason, scheduled_deletion_at)
         VALUES ($1, $2, now() - interval '1 minute')
         RETURNING id`,
        [user.id, 'Sensitive claim rollback reason'],
      );
      const dropFailureTrigger = await installAccountDeletionFailureTrigger({
        requestId: deletionRequest.rows[0].id,
        mode: 'claim',
      });
      const identityProvider = {
        deleteUser: vi.fn().mockResolvedValue({ deleted: true, signedOut: true }),
      };
      const objectStorage = {
        deleteOwnedObject: vi.fn().mockResolvedValue({ deleted: true }),
      };

      try {
        const result = await processDueAccountDeletions({
          batchSize: 1,
          identityProvider,
          objectStorage,
        });

        expect(result).toMatchObject({ processed: 1, completed: 0, failed: 1, skipped: 0 });
        expect(result.results[0]).toMatchObject({
          status: 'FAILED',
          reason: 'claim_persistence_failed',
        });
        expect(identityProvider.deleteUser).not.toHaveBeenCalled();
        expect(objectStorage.deleteOwnedObject).not.toHaveBeenCalled();

        const persisted = await query(
          `SELECT u.status AS user_status,
                  adr.status AS request_status,
                  adr.cleanup_state,
                  adr.cleanup_attempts,
                  adr.cleanup_last_error_code,
                  adr.cleanup_lease_token,
                  adr.cleanup_lease_expires_at,
                  adr.completed_at
             FROM users u
             JOIN account_deletion_requests adr ON adr.user_id = u.id
            WHERE u.id = $1`,
          [user.id],
        );

        expect(persisted.rows[0]).toMatchObject({
          user_status: 'ACTIVE',
          request_status: 'REQUESTED',
          cleanup_state: 'PENDING',
          cleanup_attempts: 0,
          cleanup_last_error_code: null,
          cleanup_lease_token: null,
          cleanup_lease_expires_at: null,
          completed_at: null,
        });
      } finally {
        await dropFailureTrigger();
        await cleanupUser(user.id);
      }
    });

      it('keeps the request retryable and account fail-closed when provider cleanup fails', async () => {
    const user = await createUser({ displayName: 'Provider Failure Target' });
    const cognitoSub = `processor-failure-sub-${user.id}`;
    await query(
      `UPDATE users
       SET cognito_sub = $2
       WHERE id = $1`,
      [user.id, cognitoSub],
    );
      const deletionRequest = await query(
        `INSERT INTO account_deletion_requests (user_id, reason, scheduled_deletion_at)
         VALUES ($1, $2, now() - interval '1 minute')
         RETURNING id`,
        [user.id, 'Sensitive deletion reason'],
      );
    const identityProvider = {
      deleteUser: vi.fn().mockRejectedValue(Object.assign(new Error('provider down'), {
        name: 'ProviderUnavailable',
      })),
    };
    const objectStorage = {
      deleteOwnedObject: vi.fn(),
    };

    try {
      const result = await processDueAccountDeletions({
        batchSize: 1,
        identityProvider,
        objectStorage,
      });

      expect(result).toMatchObject({
        processed: 1,
        completed: 0,
        skipped: 0,
        failed: 1,
      });
      expect(result.results[0]).toMatchObject({
        status: 'FAILED',
        reason: 'external_cleanup_failed',
      });

      const persisted = await query(
        `SELECT u.status AS user_status,
                u.phone_number,
                u.deleted_at,
                adr.status AS request_status,
                adr.completed_at
           FROM users u
           JOIN account_deletion_requests adr ON adr.user_id = u.id
          WHERE u.id = $1`,
        [user.id],
      );

        expect(persisted.rows[0]).toMatchObject({
          user_status: 'DELETED',
          phone_number: user.phone_number,
          deleted_at: null,
          request_status: 'PROCESSING',
          completed_at: null,
        });
        const processingAudit = await query(
          `SELECT actor_role,
                  action,
                  previous_status,
                  new_status,
                  reason,
                  metadata
             FROM audit_logs
            WHERE entity_id = $1
              AND action = 'ACCOUNT_DELETION_PROCESSING_STARTED'`,
          [deletionRequest.rows[0].id],
        );
        expect(processingAudit.rowCount).toBe(1);
        expect(processingAudit.rows[0]).toMatchObject({
          actor_role: 'SYSTEM',
          action: 'ACCOUNT_DELETION_PROCESSING_STARTED',
          previous_status: 'REQUESTED',
          new_status: 'PROCESSING',
          reason: null,
          metadata: {
            cleanupState: 'CLEANUP_IN_PROGRESS',
            failClosedUserStatus: 'DELETED',
          },
        });
        expect(objectStorage.deleteOwnedObject).not.toHaveBeenCalled();
        await expect(authService.mapIdentityToUser({
        provider: 'cognito',
        subject: cognitoSub,
        phoneNumber: null,
        phoneNumberVerified: false,
        tokenUse: 'access',
      })).rejects.toMatchObject({ statusCode: 403, code: 'ACCOUNT_DELETED' });
      } finally {
        await cleanupUser(user.id);
        }
        });

      it('keeps the request retryable when owned-object cleanup cannot run without bucket config', async () => {
        const user = await createUser({ displayName: 'Missing Bucket Target' });
        const cognitoSub = `missing-bucket-sub-${user.id}`;
        const avatarUrl = 's3://trustbite-invoices/avatars/missing-bucket.png';
        await query(
          `UPDATE users
           SET cognito_sub = $2,
               avatar_url = $3
           WHERE id = $1`,
          [user.id, cognitoSub, avatarUrl],
        );
        await query(
          `INSERT INTO account_deletion_requests (user_id, reason, scheduled_deletion_at)
           VALUES ($1, $2, now() - interval '1 minute')`,
          [user.id, 'Sensitive missing bucket deletion reason'],
        );
        const identityProvider = {
          deleteUser: vi.fn().mockResolvedValue({ deleted: true, signedOut: true }),
        };
        const send = vi.fn();
        const objectStorage = new S3ObjectStorage({
          bucketName: '',
          client: { send },
        });

        try {
          const result = await processDueAccountDeletions({
            batchSize: 1,
            identityProvider,
            objectStorage,
          });

          expect(result).toMatchObject({
            processed: 1,
            completed: 0,
            skipped: 0,
            failed: 1,
          });
          expect(result.results[0]).toMatchObject({
            status: 'FAILED',
            reason: 'external_cleanup_failed',
            errorName: 'S3BucketConfigurationError',
          });
          expect(identityProvider.deleteUser).toHaveBeenCalledWith({ username: cognitoSub });
          expect(send).not.toHaveBeenCalled();

          const persisted = await query(
            `SELECT u.status AS user_status,
                    u.avatar_url,
                    u.deleted_at,
                    adr.status AS request_status,
                    adr.cleanup_state,
                    adr.cleanup_attempts,
                    adr.cleanup_last_error_code,
                    adr.completed_at
               FROM users u
               JOIN account_deletion_requests adr ON adr.user_id = u.id
              WHERE u.id = $1`,
            [user.id],
          );

          expect(persisted.rows[0]).toMatchObject({
            user_status: 'DELETED',
            avatar_url: avatarUrl,
            deleted_at: null,
            request_status: 'PROCESSING',
            cleanup_state: 'RETRYABLE',
            cleanup_attempts: 1,
            cleanup_last_error_code: 'EXTERNAL_CLEANUP_FAILED',
            completed_at: null,
          });
        } finally {
          await cleanupUser(user.id);
        }
      });

      it('keeps the request retryable when completion persistence fails after external cleanup', async () => {
      const user = await createUser({ displayName: 'Completion Retry Target' });
      const cognitoSub = `completion-retry-sub-${user.id}`;
      await query(
        `UPDATE users
         SET cognito_sub = $2,
             avatar_url = $3
         WHERE id = $1`,
        [user.id, cognitoSub, 's3://trustbite-invoices/avatars/completion-retry.png'],
      );
      const deletionRequest = await query(
        `INSERT INTO account_deletion_requests (user_id, reason, scheduled_deletion_at)
         VALUES ($1, $2, now() - interval '1 minute')
         RETURNING id`,
        [user.id, 'Sensitive completion retry reason'],
      );
      const dropFailureTrigger = await installAccountDeletionFailureTrigger({
        requestId: deletionRequest.rows[0].id,
        mode: 'completion',
      });
      const identityProvider = {
        deleteUser: vi.fn().mockResolvedValue({ deleted: true, signedOut: true }),
      };
      const objectStorage = {
        deleteOwnedObject: vi.fn().mockResolvedValue({ deleted: true }),
      };

      try {
        const result = await processDueAccountDeletions({
          batchSize: 1,
          identityProvider,
          objectStorage,
        });

        expect(result).toMatchObject({ processed: 1, completed: 0, failed: 1, skipped: 0 });
        expect(result.results[0]).toMatchObject({
          status: 'FAILED',
          reason: 'completion_persistence_failed',
        });
        expect(identityProvider.deleteUser).toHaveBeenCalledWith({ username: cognitoSub });
        expect(objectStorage.deleteOwnedObject).toHaveBeenCalledWith('s3://trustbite-invoices/avatars/completion-retry.png');

        const persisted = await query(
          `SELECT u.status AS user_status,
                  u.phone_number,
                  u.deleted_at,
                  adr.status AS request_status,
                  adr.cleanup_state,
                  adr.cleanup_attempts,
                  adr.cleanup_last_error_code,
                  adr.cleanup_last_error_at,
                  adr.cleanup_lease_token,
                  adr.cleanup_lease_expires_at,
                  adr.completed_at
             FROM users u
             JOIN account_deletion_requests adr ON adr.user_id = u.id
            WHERE u.id = $1`,
          [user.id],
        );

        expect(persisted.rows[0]).toMatchObject({
          user_status: 'DELETED',
          phone_number: user.phone_number,
          deleted_at: null,
          request_status: 'PROCESSING',
          cleanup_state: 'RETRYABLE',
          cleanup_attempts: 1,
          cleanup_last_error_code: 'COMPLETION_PERSISTENCE_FAILED',
          cleanup_lease_token: null,
          cleanup_lease_expires_at: null,
          completed_at: null,
        });
        expect(persisted.rows[0].cleanup_last_error_at).toBeTruthy();
      } finally {
        await dropFailureTrigger();
        await cleanupUser(user.id);
      }
    });

    it('uses a Cognito-compatible admin cleanup test double for sign-out, delete, and missing-user idempotency', async () => {
      const adminClient = new InMemoryCognitoAdminClient(['cognito-double-sub']);
      const provider = new CognitoIdentityProvider({
        adminClient,
        userPoolId: 'privacy-test-pool',
      });

      const deleted = await provider.deleteUser({ username: 'cognito-double-sub' });
      const alreadyMissing = await provider.deleteUser({ username: 'cognito-double-sub' });

      expect(deleted).toMatchObject({ deleted: true, signedOut: true });
      expect(alreadyMissing).toMatchObject({ deleted: false, alreadyMissing: true, signedOut: false });
      expect(adminClient.calls).toEqual([
        {
          commandName: 'AdminUserGlobalSignOutCommand',
          input: { UserPoolId: 'privacy-test-pool', Username: 'cognito-double-sub' },
        },
        {
          commandName: 'AdminDeleteUserCommand',
          input: { UserPoolId: 'privacy-test-pool', Username: 'cognito-double-sub' },
        },
        {
          commandName: 'AdminUserGlobalSignOutCommand',
          input: { UserPoolId: 'privacy-test-pool', Username: 'cognito-double-sub' },
        },
        {
          commandName: 'AdminDeleteUserCommand',
          input: { UserPoolId: 'privacy-test-pool', Username: 'cognito-double-sub' },
        },
      ]);
    });

    it('persists cleanup lease, retry state, and legal-hold skips across processor runs', async () => {
      const retryUser = await createUser({ displayName: 'Retry State Target' });
      const legalHoldUser = await createUser({ displayName: 'Legal Hold Target' });
      const retrySub = `retry-state-sub-${retryUser.id}`;
      const legalHoldSub = `legal-hold-sub-${legalHoldUser.id}`;
      await query(
        `UPDATE users
         SET cognito_sub = $2
         WHERE id = $1`,
        [retryUser.id, retrySub],
      );
      await query(
        `UPDATE users
         SET cognito_sub = $2
         WHERE id = $1`,
        [legalHoldUser.id, legalHoldSub],
      );
      const retryRequest = await query(
        `INSERT INTO account_deletion_requests (user_id, reason, scheduled_deletion_at)
         VALUES ($1, $2, now() - interval '1 minute')
         RETURNING id`,
        [retryUser.id, 'Sensitive retry deletion reason'],
      );
      const legalHoldRequest = await query(
        `INSERT INTO account_deletion_requests (
           user_id,
           reason,
           scheduled_deletion_at,
           legal_hold,
           legal_hold_reason,
           retained_data_reason
         )
         VALUES ($1, $2, now() - interval '1 minute', true, $3, $4)
         RETURNING id`,
        [
          legalHoldUser.id,
          'Sensitive legal hold deletion reason',
          'LEGAL_HOLD_CASE:case-123',
          'LEGAL_HOLD_CASE:case-123',
        ],
      );
      const identityProvider = {
        deleteUser: vi
          .fn()
          .mockRejectedValueOnce(Object.assign(new Error('provider down'), {
            name: 'ProviderUnavailable',
          }))
          .mockImplementationOnce(async ({ username }) => {
            const inFlight = await query(
              `SELECT cleanup_state,
                      cleanup_attempts,
                      cleanup_lease_token,
                      cleanup_lease_expires_at,
                      cleanup_last_error_code
                 FROM account_deletion_requests
                WHERE id = $1`,
              [retryRequest.rows[0].id],
            );
            expect(username).toBe(retrySub);
            expect(inFlight.rows[0]).toMatchObject({
              cleanup_state: 'CLEANUP_IN_PROGRESS',
              cleanup_attempts: 2,
              cleanup_last_error_code: 'EXTERNAL_CLEANUP_FAILED',
            });
            expect(inFlight.rows[0].cleanup_lease_token).toEqual(expect.any(String));
            expect(inFlight.rows[0].cleanup_lease_expires_at).toBeTruthy();
            return { deleted: true, signedOut: true };
          }),
      };
      const objectStorage = {
        deleteOwnedObject: vi.fn().mockResolvedValue({ deleted: true }),
      };

      try {
        const failed = await processDueAccountDeletions({
          batchSize: 1,
          identityProvider,
          objectStorage,
        });

        expect(failed).toMatchObject({ processed: 1, completed: 0, failed: 1, skipped: 0 });
        const retryAfterFailure = await query(
          `SELECT status,
                  cleanup_state,
                  cleanup_attempts,
                  cleanup_last_error_code,
                  cleanup_last_error_at,
                  cleanup_lease_token,
                  cleanup_lease_expires_at,
                  completed_at
             FROM account_deletion_requests
            WHERE id = $1`,
          [retryRequest.rows[0].id],
        );
        expect(retryAfterFailure.rows[0]).toMatchObject({
          status: 'PROCESSING',
          cleanup_state: 'RETRYABLE',
          cleanup_attempts: 1,
          cleanup_last_error_code: 'EXTERNAL_CLEANUP_FAILED',
          cleanup_lease_token: null,
          cleanup_lease_expires_at: null,
          completed_at: null,
        });
        expect(retryAfterFailure.rows[0].cleanup_last_error_at).toBeTruthy();

        const completedRetry = await processDueAccountDeletions({
          batchSize: 1,
          identityProvider,
          objectStorage,
        });

        expect(completedRetry).toMatchObject({ processed: 1, completed: 1, failed: 0, skipped: 0 });
        const retryAfterSuccess = await query(
          `SELECT status,
                  cleanup_state,
                  cleanup_attempts,
                  cleanup_last_error_code,
                  cleanup_last_error_at,
                  cleanup_lease_token,
                  cleanup_lease_expires_at,
                  completed_at
             FROM account_deletion_requests
            WHERE id = $1`,
          [retryRequest.rows[0].id],
        );
        expect(retryAfterSuccess.rows[0]).toMatchObject({
          status: 'COMPLETED',
          cleanup_state: 'COMPLETED',
          cleanup_attempts: 2,
          cleanup_last_error_code: null,
          cleanup_last_error_at: null,
          cleanup_lease_token: null,
          cleanup_lease_expires_at: null,
        });
        expect(retryAfterSuccess.rows[0].completed_at).toBeTruthy();

        const legalHoldSkipped = await processDueAccountDeletions({
          batchSize: 1,
          identityProvider,
          objectStorage,
        });

        expect(legalHoldSkipped).toMatchObject({ processed: 1, completed: 0, failed: 0, skipped: 1 });
        expect(legalHoldSkipped.results[0]).toMatchObject({
          status: 'SKIPPED',
          reason: 'legal_hold',
        });
        const legalHoldRows = await query(
          `SELECT adr.status,
                  adr.cleanup_state,
                  adr.cleanup_attempts,
                  adr.cleanup_last_error_code,
                  adr.cleanup_lease_token,
                  adr.cleanup_lease_expires_at,
                  adr.legal_hold,
                  adr.legal_hold_reason,
                  u.status AS user_status,
                  u.deleted_at
             FROM account_deletion_requests adr
             JOIN users u ON u.id = adr.user_id
            WHERE adr.id = $1`,
          [legalHoldRequest.rows[0].id],
        );
        expect(legalHoldRows.rows[0]).toMatchObject({
          status: 'REQUESTED',
          cleanup_state: 'LEGAL_HOLD',
          cleanup_attempts: 0,
          cleanup_last_error_code: null,
          cleanup_lease_token: null,
          cleanup_lease_expires_at: null,
          legal_hold: true,
          legal_hold_reason: 'LEGAL_HOLD_CASE:case-123',
          user_status: 'ACTIVE',
          deleted_at: null,
        });
        expect(identityProvider.deleteUser).toHaveBeenCalledTimes(2);
      } finally {
        await cleanupUser(retryUser.id);
        await cleanupUser(legalHoldUser.id);
      }
    });

    it('continues the batch after a legal-hold request is skipped', async () => {
      const legalHoldUser = await createUser({ displayName: 'Batch Legal Hold Target' });
      const dueUser = await createUser({ displayName: 'Batch Due Target' });
      await query(
        `UPDATE users
         SET cognito_sub = $2
         WHERE id = $1`,
        [dueUser.id, `batch-due-sub-${dueUser.id}`],
      );
      await query(
        `INSERT INTO account_deletion_requests (
           user_id,
           reason,
           requested_at,
           scheduled_deletion_at,
           legal_hold,
           legal_hold_reason,
           retained_data_reason
         )
         VALUES ($1, $2, now() - interval '3 minutes', now() - interval '2 minutes', true, $3, $4)`,
        [
          legalHoldUser.id,
          'Sensitive legal hold batch reason',
          'LEGAL_HOLD_CASE:batch-123',
          'LEGAL_HOLD_CASE:batch-123',
        ],
      );
      await query(
        `INSERT INTO account_deletion_requests (
           user_id,
           reason,
           requested_at,
           scheduled_deletion_at
         )
         VALUES ($1, $2, now() - interval '2 minutes', now() - interval '1 minute')`,
        [dueUser.id, 'Sensitive due batch reason'],
      );
      const identityProvider = {
        deleteUser: vi.fn().mockResolvedValue({ deleted: true, signedOut: true }),
      };
      const objectStorage = {
        deleteOwnedObject: vi.fn().mockResolvedValue({ deleted: true }),
      };

      try {
        const result = await processDueAccountDeletions({
          batchSize: 2,
          identityProvider,
          objectStorage,
        });

        expect(result).toMatchObject({ processed: 2, completed: 1, failed: 0, skipped: 1 });
        expect(result.results.map((entry) => entry.status)).toEqual(['SKIPPED', 'COMPLETED']);
        expect(result.results[0]).toMatchObject({ reason: 'legal_hold' });
        expect(identityProvider.deleteUser).toHaveBeenCalledTimes(1);

        const rows = await query(
          `SELECT adr.cleanup_state, u.status AS user_status
           FROM account_deletion_requests adr
           JOIN users u ON u.id = adr.user_id
           WHERE u.id IN ($1, $2)
           ORDER BY adr.requested_at ASC`,
          [legalHoldUser.id, dueUser.id],
        );

        expect(rows.rows).toEqual([
          expect.objectContaining({
            cleanup_state: 'LEGAL_HOLD',
            user_status: 'ACTIVE',
          }),
          expect.objectContaining({
            cleanup_state: 'COMPLETED',
            user_status: 'DELETED',
          }),
        ]);
      } finally {
        await cleanupUser(legalHoldUser.id);
        await cleanupUser(dueUser.id);
      }
    });

    it('continues the batch after a lock-busy request is skipped', async () => {
      const lockedUser = await createUser({ displayName: 'Batch Lock Busy Target' });
      const dueUser = await createUser({ displayName: 'Batch Lock Due Target' });
      await query(
        `UPDATE users
         SET cognito_sub = $2
         WHERE id = $1`,
        [dueUser.id, `batch-lock-due-sub-${dueUser.id}`],
      );
      const lockedRequest = await query(
        `INSERT INTO account_deletion_requests (
           user_id,
           status,
           reason,
           requested_at,
           scheduled_deletion_at,
           cleanup_state
         )
         VALUES ($1, 'PROCESSING', $2, now() - interval '3 minutes', now() - interval '2 minutes', 'RETRYABLE')
         RETURNING id`,
        [lockedUser.id, 'Sensitive lock-busy batch reason'],
      );
      await query(
        `INSERT INTO account_deletion_requests (
           user_id,
           reason,
           requested_at,
           scheduled_deletion_at
         )
         VALUES ($1, $2, now() - interval '2 minutes', now() - interval '1 minute')`,
        [dueUser.id, 'Sensitive due after lock reason'],
      );
      const identityProvider = {
        deleteUser: vi.fn().mockResolvedValue({ deleted: true, signedOut: true }),
      };
      const objectStorage = {
        deleteOwnedObject: vi.fn().mockResolvedValue({ deleted: true }),
      };
      const lockClient = await pool.connect();

      try {
        await lockClient.query(
          `SELECT pg_advisory_lock(hashtextextended('account_deletion:' || $1::text, 0))`,
          [lockedRequest.rows[0].id],
        );

        const result = await processDueAccountDeletions({
          batchSize: 2,
          identityProvider,
          objectStorage,
        });

        expect(result).toMatchObject({ processed: 2, completed: 1, failed: 0, skipped: 1 });
        expect(result.results.map((entry) => entry.status)).toEqual(['SKIPPED', 'COMPLETED']);
        expect(result.results[0]).toMatchObject({ reason: 'lock_busy' });
        expect(identityProvider.deleteUser).toHaveBeenCalledTimes(1);

        const rows = await query(
          `SELECT adr.status, adr.cleanup_state, u.status AS user_status
           FROM account_deletion_requests adr
           JOIN users u ON u.id = adr.user_id
           WHERE u.id IN ($1, $2)
           ORDER BY adr.requested_at ASC`,
          [lockedUser.id, dueUser.id],
        );

        expect(rows.rows).toEqual([
          expect.objectContaining({
            status: 'PROCESSING',
            cleanup_state: 'RETRYABLE',
            user_status: 'ACTIVE',
          }),
          expect.objectContaining({
            status: 'COMPLETED',
            cleanup_state: 'COMPLETED',
            user_status: 'DELETED',
          }),
        ]);
      } finally {
        await lockClient.query(
          `SELECT pg_advisory_unlock(hashtextextended('account_deletion:' || $1::text, 0))`,
          [lockedRequest.rows[0].id],
        );
        lockClient.release();
        await cleanupUser(lockedUser.id);
        await cleanupUser(dueUser.id);
      }
    });

    it('continues the batch after a retryable cleanup failure', async () => {
      const failingUser = await createUser({ displayName: 'Batch Retryable Failure Target' });
      const dueUser = await createUser({ displayName: 'Batch After Failure Target' });
      await query(
        `UPDATE users
         SET cognito_sub = $2
         WHERE id = $1`,
        [failingUser.id, `batch-failure-sub-${failingUser.id}`],
      );
      await query(
        `UPDATE users
         SET cognito_sub = $2
         WHERE id = $1`,
        [dueUser.id, `batch-after-failure-sub-${dueUser.id}`],
      );
      await query(
        `INSERT INTO account_deletion_requests (
           user_id,
           reason,
           requested_at,
           scheduled_deletion_at
         )
         VALUES ($1, $2, now() - interval '3 minutes', now() - interval '2 minutes')`,
        [failingUser.id, 'Sensitive failing batch reason'],
      );
      await query(
        `INSERT INTO account_deletion_requests (
           user_id,
           reason,
           requested_at,
           scheduled_deletion_at
         )
         VALUES ($1, $2, now() - interval '2 minutes', now() - interval '1 minute')`,
        [dueUser.id, 'Sensitive due after failure reason'],
      );
      const identityProvider = {
        deleteUser: vi
          .fn()
          .mockRejectedValueOnce(Object.assign(new Error('provider down'), {
            name: 'ProviderUnavailable',
          }))
          .mockResolvedValueOnce({ deleted: true, signedOut: true }),
      };
      const objectStorage = {
        deleteOwnedObject: vi.fn().mockResolvedValue({ deleted: true }),
      };

      try {
        const result = await processDueAccountDeletions({
          batchSize: 2,
          identityProvider,
          objectStorage,
        });

        expect(result).toMatchObject({ processed: 2, completed: 1, failed: 1, skipped: 0 });
        expect(result.results.map((entry) => entry.status)).toEqual(['FAILED', 'COMPLETED']);
        expect(result.results[0]).toMatchObject({ reason: 'external_cleanup_failed' });
        expect(identityProvider.deleteUser).toHaveBeenCalledTimes(2);

        const rows = await query(
          `SELECT adr.status, adr.cleanup_state, adr.completed_at, u.status AS user_status
           FROM account_deletion_requests adr
           JOIN users u ON u.id = adr.user_id
           WHERE u.id IN ($1, $2)
           ORDER BY adr.requested_at ASC`,
          [failingUser.id, dueUser.id],
        );

        expect(rows.rows).toEqual([
          expect.objectContaining({
            status: 'PROCESSING',
            cleanup_state: 'RETRYABLE',
            completed_at: null,
            user_status: 'DELETED',
          }),
          expect.objectContaining({
            status: 'COMPLETED',
            cleanup_state: 'COMPLETED',
            user_status: 'DELETED',
          }),
        ]);
        expect(rows.rows[1].completed_at).toBeTruthy();
      } finally {
        await cleanupUser(failingUser.id);
        await cleanupUser(dueUser.id);
      }
    });

    it('removes relationship and system rows that would keep deleted-account state active', async () => {
      const user = await createUser({ displayName: 'Relationship Retention Target' });
    const otherUser = await createUser({ displayName: 'Relationship Retention Other' });
    const restaurant = await createRestaurant();
    const review = await createReview({ userId: user.id, restaurantId: restaurant.id });
    const otherReview = await createReview({ userId: otherUser.id, restaurantId: restaurant.id });
    await query(
      `INSERT INTO roles (id, label, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      ['TEST_PRIVACY_ROLE', 'Privacy test role', 'Role for account deletion processor tests'],
    );
    await query(
      `INSERT INTO badge_definitions (code, label, category)
       VALUES ($1, $2, $3)
       ON CONFLICT (code) DO NOTHING`,
      ['TEST_PRIVACY_BADGE', 'Privacy test badge', 'GAMIFICATION'],
    );
    const tag = await query(
      `INSERT INTO tags (code, label, category)
       VALUES ($1, $2, $3)
       ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label
       RETURNING id`,
      [`privacy-test-${user.id.slice(0, 8)}`, 'Privacy test tag', 'REVIEW'],
    );
    await query(
      `INSERT INTO rank_definitions (code, label, min_exp, description)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (code) DO NOTHING`,
      ['TEST_PRIVACY_RANK', 'Privacy rank', 10, 'Rank reset proof'],
    );
    await query(
      `UPDATE users
       SET cognito_sub = $2,
           rank_code = 'TEST_PRIVACY_RANK',
           exp_points = 100,
           review_restricted_until = now() + interval '1 day'
       WHERE id = $1`,
      [user.id, `relationship-retention-sub-${user.id}`],
    );
    const merchant = await query(
      `INSERT INTO merchants (user_id, business_name, status)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [user.id, 'Relationship Merchant Name', 'ACTIVE'],
    );
    const pushToken = await query(
      `INSERT INTO push_tokens (user_id, platform, token_ciphertext, token_fingerprint, provider)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [user.id, 'IOS', `relationship-ciphertext-${user.id}`, `relationship-fingerprint-${user.id}`, 'APNS'],
    );
    const notification = await query(
      `INSERT INTO notifications (recipient_user_id, type, title, body, payload)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [user.id, 'PRIVACY_TEST', 'Sensitive notification title', 'Sensitive notification body', { userId: user.id }],
    );
    const savedList = await query(
      `INSERT INTO user_saved_lists (user_id, name, description, is_public)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [user.id, 'Sensitive favorites', 'Private saved-list description', true],
    );
    await query(
      `INSERT INTO account_deletion_requests (user_id, reason, scheduled_deletion_at)
       VALUES ($1, $2, now() - interval '1 minute')`,
      [user.id, 'Sensitive relationship deletion reason'],
    );

    await query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [user.id, 'TEST_PRIVACY_ROLE']);
    await query('INSERT INTO user_badges (user_id, badge_code) VALUES ($1, $2)', [user.id, 'TEST_PRIVACY_BADGE']);
    await query('INSERT INTO exp_transactions (user_id, delta, reason, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5)', [user.id, 10, 'review_created', 'REVIEW', review.id]);
    await query('INSERT INTO user_saved_list_restaurants (saved_list_id, restaurant_id) VALUES ($1, $2)', [savedList.rows[0].id, restaurant.id]);
    await query('INSERT INTO user_follows (follower_id, following_id) VALUES ($1, $2)', [user.id, otherUser.id]);
    await query('INSERT INTO user_follows (follower_id, following_id) VALUES ($1, $2)', [otherUser.id, user.id]);
    await query('INSERT INTO user_blocks (blocker_user_id, blocked_user_id, reason_code, source_review_id) VALUES ($1, $2, $3, $4)', [user.id, otherUser.id, 'privacy-test', review.id]);
    await query('INSERT INTO user_blocks (blocker_user_id, blocked_user_id, reason_code, source_review_id) VALUES ($1, $2, $3, $4)', [otherUser.id, user.id, 'privacy-test', otherReview.id]);
    await query('INSERT INTO review_tags (review_id, tag_id) VALUES ($1, $2)', [review.id, tag.rows[0].id]);
    await query('INSERT INTO review_votes (review_id, user_id, vote_type) VALUES ($1, $2, $3)', [review.id, otherUser.id, 'HELPFUL']);
    await query('INSERT INTO review_votes (review_id, user_id, vote_type) VALUES ($1, $2, $3)', [otherReview.id, user.id, 'HELPFUL']);
    await query('INSERT INTO review_replies (review_id, merchant_id, message) VALUES ($1, $2, $3)', [review.id, merchant.rows[0].id, 'Sensitive merchant reply']);
    await query('INSERT INTO notification_delivery_logs (notification_id, push_token_id, status, error_message) VALUES ($1, $2, $3, $4)', [notification.rows[0].id, pushToken.rows[0].id, 'FAILED', 'Sensitive delivery error']);
    await query(
      `INSERT INTO idempotency_keys (
         idempotency_key, user_id, endpoint, request_hash, status, response_status_code, response_body, resource_type, resource_id, expires_at
       )
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, now() + interval '1 day')`,
      [user.id, '/api/v1/reviews', 'b'.repeat(64), 'COMPLETED', 201, { comment: 'Sensitive cached response' }, 'REVIEW', review.id],
    );
    const identityProvider = {
      deleteUser: vi.fn().mockResolvedValue({ deleted: true, signedOut: true }),
    };
    const objectStorage = {
      deleteOwnedObject: vi.fn().mockResolvedValue({ deleted: true }),
    };

    try {
      const result = await processDueAccountDeletions({
        batchSize: 1,
        identityProvider,
        objectStorage,
      });

      expect(result).toMatchObject({ processed: 1, completed: 1, failed: 0 });
      const counts = await query(
        `SELECT
           (SELECT count(*)::int FROM user_roles WHERE user_id = $1) AS user_roles,
           (SELECT count(*)::int FROM user_badges WHERE user_id = $1) AS user_badges,
           (SELECT count(*)::int FROM exp_transactions WHERE user_id = $1) AS exp_transactions,
           (SELECT count(*)::int FROM user_saved_lists WHERE user_id = $1) AS saved_lists,
           (SELECT count(*)::int FROM user_follows WHERE follower_id = $1 OR following_id = $1) AS follows,
           (SELECT count(*)::int FROM user_blocks WHERE blocker_user_id = $1 OR blocked_user_id = $1) AS blocks,
           (SELECT count(*)::int FROM review_tags WHERE review_id = $2) AS review_tags,
           (SELECT count(*)::int FROM review_votes WHERE user_id = $1 OR review_id = $2) AS review_votes,
           (SELECT count(*)::int FROM notifications WHERE recipient_user_id = $1) AS notifications,
           (SELECT count(*)::int FROM notification_delivery_logs WHERE push_token_id = $3) AS notification_delivery_logs,
           (SELECT count(*)::int FROM idempotency_keys WHERE user_id = $1) AS idempotency_keys`,
        [user.id, review.id, pushToken.rows[0].id],
      );
      const userProfile = await query(
        `SELECT rank_code, exp_points, review_restricted_until
         FROM users
         WHERE id = $1`,
        [user.id],
      );
      const replies = await query(
        `SELECT status, message
         FROM review_replies
         WHERE review_id = $1 OR merchant_id = $2`,
        [review.id, merchant.rows[0].id],
      );

      expect(counts.rows[0]).toMatchObject({
        user_roles: 0,
        user_badges: 0,
        exp_transactions: 0,
        saved_lists: 0,
        follows: 0,
        blocks: 0,
        review_tags: 0,
        review_votes: 0,
        notifications: 0,
        notification_delivery_logs: 0,
        idempotency_keys: 0,
      });
      expect(userProfile.rows[0]).toMatchObject({
        rank_code: 'NEWBIE',
        exp_points: 0,
        review_restricted_until: null,
      });
      expect(replies.rows).toHaveLength(1);
      expect(replies.rows[0]).toMatchObject({
        status: 'HIDDEN',
        message: 'Deleted account reply',
      });
    } finally {
      await cleanupUser(user.id);
      await cleanupUser(otherUser.id);
      await query('DELETE FROM restaurants WHERE id = $1', [restaurant.id]);
    }
  });

  it('detaches price observations, invalidates summaries, and recomputes restaurant aggregates from remaining public reviews', async () => {
    const user = await createUser({ displayName: 'Derived Retention Target' });
    const otherUser = await createUser({ displayName: 'Derived Retention Other' });
    const restaurant = await createRestaurant({
      trustScore: 1.25,
      verifiedReviewCount: 99,
      referenceReviewCount: 99,
    });
    const deletedReview = await createReview({
      userId: user.id,
      restaurantId: restaurant.id,
      foodRating: 1,
      priceRating: 1,
      serviceRating: 1,
      ambienceRating: 1,
      comment: 'Review that must leave aggregates',
      verificationStatus: 'VERIFIED',
      trustWeightBucket: 'FULL',
    });
      const remainingReview = await createReview({
        userId: otherUser.id,
        restaurantId: restaurant.id,
      foodRating: 4,
      priceRating: 5,
      serviceRating: 5,
      ambienceRating: 4,
      verificationStatus: 'VERIFIED',
        trustWeightBucket: 'FULL',
        publicVisibility: 'PUBLIC',
      });
      const hiddenRemainingReview = await createReview({
        userId: otherUser.id,
        restaurantId: restaurant.id,
        foodRating: 1,
        priceRating: 1,
        serviceRating: 1,
        ambienceRating: 1,
        status: 'HIDDEN',
        verificationStatus: 'VERIFIED',
        trustWeightBucket: 'FULL',
        publicVisibility: 'PUBLIC',
      });
    const menuItem = await query(
      `INSERT INTO menu_items (restaurant_id, name, price_default)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [restaurant.id, 'Derived retention menu item', 50000],
    );
    const priceHistory = await query(
      `INSERT INTO price_history (menu_item_id, observed_price, source, review_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [menuItem.rows[0].id, 50000, 'OCR_RECEIPT', deletedReview.id],
    );
    await query(
      `INSERT INTO review_summaries (restaurant_id, summary_text, model_version, review_count, avg_rating)
       VALUES ($1, $2, $3, $4, $5)`,
      [restaurant.id, 'Summary text containing deleted review content', 'test-model', 2, 3.00],
    );
    await query(
      `UPDATE users
       SET cognito_sub = $2
       WHERE id = $1`,
      [user.id, `derived-retention-sub-${user.id}`],
    );
    await query(
      `INSERT INTO account_deletion_requests (user_id, reason, scheduled_deletion_at)
       VALUES ($1, $2, now() - interval '1 minute')`,
      [user.id, 'Sensitive derived deletion reason'],
    );
    const identityProvider = {
      deleteUser: vi.fn().mockResolvedValue({ deleted: true, signedOut: true }),
    };
    const objectStorage = {
      deleteOwnedObject: vi.fn().mockResolvedValue({ deleted: true }),
    };

    try {
      const result = await processDueAccountDeletions({
        batchSize: 1,
        identityProvider,
        objectStorage,
      });

      expect(result).toMatchObject({ processed: 1, completed: 1, failed: 0 });
      const priceRows = await query(
        `SELECT review_id
         FROM price_history
         WHERE id = $1`,
        [priceHistory.rows[0].id],
      );
      const summaryRows = await query(
        `SELECT count(*)::int AS count
         FROM review_summaries
         WHERE restaurant_id = $1`,
        [restaurant.id],
      );
      const restaurantRows = await query(
        `SELECT trust_score, verified_review_count, reference_review_count
         FROM restaurants
         WHERE id = $1`,
        [restaurant.id],
      );
      const deletedReviewRows = await query(
        `SELECT status, trust_weight_bucket, public_visibility
         FROM reviews
         WHERE id = $1`,
        [deletedReview.id],
      );

      expect(priceRows.rows[0].review_id).toBeNull();
      expect(summaryRows.rows[0].count).toBe(0);
      expect(Number(restaurantRows.rows[0].trust_score)).toBe(4.50);
      expect(restaurantRows.rows[0]).toMatchObject({
        verified_review_count: 1,
        reference_review_count: 0,
      });
        expect(deletedReviewRows.rows[0]).toMatchObject({
          status: 'DELETED',
          trust_weight_bucket: 'NONE',
          public_visibility: 'PRIVATE',
        });
        expect(remainingReview.id).toEqual(expect.any(String));
        expect(hiddenRemainingReview.id).toEqual(expect.any(String));
      } finally {
      await cleanupUser(user.id);
      await cleanupUser(otherUser.id);
      await query('DELETE FROM restaurants WHERE id = $1', [restaurant.id]);
    }
  });

  it('clears restaurant trust score when deletion leaves no eligible public reviews', async () => {
    const user = await createUser({ displayName: 'Zero Aggregate Target' });
    const restaurant = await createRestaurant({
      trustScore: 4.75,
      verifiedReviewCount: 1,
    });

    await createReview({
      userId: user.id,
      restaurantId: restaurant.id,
      foodRating: 5,
      priceRating: 5,
      serviceRating: 5,
      ambienceRating: 5,
      verificationStatus: 'VERIFIED',
      trustWeightBucket: 'FULL',
      publicVisibility: 'PUBLIC',
    });
    await query(
      `UPDATE users
       SET cognito_sub = $2
       WHERE id = $1`,
      [user.id, `zero-aggregate-sub-${user.id}`],
    );
    await query(
      `INSERT INTO account_deletion_requests (user_id, reason, scheduled_deletion_at)
       VALUES ($1, $2, now() - interval '1 minute')`,
      [user.id, 'Zero aggregate deletion reason'],
    );

    try {
      const result = await processDueAccountDeletions({
        batchSize: 1,
        identityProvider: {
          deleteUser: vi.fn().mockResolvedValue({ deleted: true, signedOut: true }),
        },
        objectStorage: {
          deleteOwnedObject: vi.fn().mockResolvedValue({ deleted: true }),
        },
      });

      expect(result).toMatchObject({ processed: 1, completed: 1, failed: 0 });
      const restaurantRows = await query(
        `SELECT trust_score, verified_review_count, reference_review_count
         FROM restaurants
         WHERE id = $1`,
        [restaurant.id],
      );

      expect(restaurantRows.rows[0].trust_score).toBeNull();
      expect(restaurantRows.rows[0]).toMatchObject({
        verified_review_count: 0,
        reference_review_count: 0,
      });
    } finally {
      await cleanupUser(user.id);
      await query('DELETE FROM restaurants WHERE id = $1', [restaurant.id]);
    }
  });

  it('minimizes moderation and audit text while retaining fraud-minimum references', async () => {
    const user = await createUser({ displayName: 'Moderation Retention Target' });
    const restaurant = await createRestaurant();
    const review = await createReview({ userId: user.id, restaurantId: restaurant.id });
    await query(
      `INSERT INTO report_reason_codes (code, label, entity_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (code) DO NOTHING`,
      ['PRIVACY_TEST_REPORT', 'Privacy report', 'REVIEW'],
    );
    await query(
      `UPDATE users
       SET cognito_sub = $2
       WHERE id = $1`,
      [user.id, `moderation-retention-sub-${user.id}`],
    );
    const moderationReport = await query(
      `INSERT INTO moderation_reports (reporter_id, entity_type, entity_id, reason_code, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [user.id, 'REVIEW', review.id, 'PRIVACY_TEST_REPORT', 'Sensitive moderation report text'],
    );
    const adminQueue = await query(
      `INSERT INTO admin_queues (queue_type, entity_id, status)
       VALUES ($1, $2, $3)
       RETURNING id`,
      ['USER_REPORT', review.id, 'ASSIGNED'],
    );
    const fraudFlag = await query(
      `INSERT INTO fraud_flags (flag_code, risk_score)
       VALUES ($1, $2)
       RETURNING id`,
      ['PRIVACY_TEST_FLAG', 80],
    );
    await query(
      `INSERT INTO moderation_actions (report_id, admin_id, action_type, entity_type, entity_id, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [moderationReport.rows[0].id, user.id, 'HIDE_REVIEW', 'REVIEW', review.id, 'Sensitive moderation action reason'],
    );
    await query(
      `INSERT INTO admin_queue_assignments (queue_id, admin_user_id)
       VALUES ($1, $2)`,
      [adminQueue.rows[0].id, user.id],
    );
    await query(
      `INSERT INTO fraud_flag_entities (fraud_flag_id, entity_type, entity_id)
       VALUES ($1, $2, $3)`,
      [fraudFlag.rows[0].id, 'REVIEW', review.id],
    );
    await query(
      `INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, reason, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        user.id,
        'USER',
        'PRIVACY_TEST_AUDIT',
        'REVIEW',
        review.id,
        'Sensitive audit reason',
        { phone: user.phone_number, comment: 'Sensitive audit metadata' },
      ],
    );
    await query(
      `INSERT INTO account_deletion_requests (user_id, reason, scheduled_deletion_at)
       VALUES ($1, $2, now() - interval '1 minute')`,
      [user.id, 'Sensitive moderation deletion reason'],
    );
    const identityProvider = {
      deleteUser: vi.fn().mockResolvedValue({ deleted: true, signedOut: true }),
    };
    const objectStorage = {
      deleteOwnedObject: vi.fn().mockResolvedValue({ deleted: true }),
    };

    try {
      const result = await processDueAccountDeletions({
        batchSize: 1,
        identityProvider,
        objectStorage,
      });

      expect(result).toMatchObject({ processed: 1, completed: 1, failed: 0 });
      const moderationRows = await query(
        `SELECT mr.description, ma.reason
         FROM moderation_reports mr
         JOIN moderation_actions ma ON ma.report_id = mr.id
         WHERE mr.id = $1`,
        [moderationReport.rows[0].id],
      );
      const assignmentRows = await query(
        `SELECT resolved_at
         FROM admin_queue_assignments
         WHERE queue_id = $1 AND admin_user_id = $2`,
        [adminQueue.rows[0].id, user.id],
      );
      const fraudRows = await query(
        `SELECT count(*)::int AS count
         FROM fraud_flag_entities
         WHERE fraud_flag_id = $1 AND entity_type = 'REVIEW' AND entity_id = $2`,
        [fraudFlag.rows[0].id, review.id],
      );
      const auditRows = await query(
        `SELECT reason, metadata
         FROM audit_logs
         WHERE action = 'PRIVACY_TEST_AUDIT' AND actor_id = $1`,
        [user.id],
      );

      expect(moderationRows.rows[0]).toMatchObject({
        description: null,
        reason: 'Deleted account moderation action',
      });
      expect(assignmentRows.rows[0].resolved_at).toBeTruthy();
      expect(fraudRows.rows[0].count).toBe(1);
      expect(auditRows.rows[0]).toMatchObject({
        reason: null,
        metadata: { retainedDataReason: 'account deletion audit minimum' },
      });
    } finally {
      await cleanupUser(user.id);
      await query('DELETE FROM restaurants WHERE id = $1', [restaurant.id]);
    }
  });

  it('minimizes receipt proof fields, review ratings, and cross-record decider references', async () => {
    const user = await createUser({ displayName: 'Receipt Retention Target' });
    const otherUser = await createUser({ displayName: 'Receipt Retention Other' });
    const restaurant = await createRestaurant();
    const review = await createReview({
      userId: user.id,
      restaurantId: restaurant.id,
      foodRating: 5,
      priceRating: 4,
      serviceRating: 5,
      ambienceRating: 4,
      verificationStatus: 'VERIFIED',
      visitedAt: new Date(),
    });
    const otherReview = await createReview({ userId: otherUser.id, restaurantId: restaurant.id });
    await query(
      `UPDATE users
       SET cognito_sub = $2
       WHERE id = $1`,
      [user.id, `receipt-retention-sub-${user.id}`],
    );
    const receipt = await query(
      `INSERT INTO receipt_verifications (
         review_id, user_id, restaurant_id, file_url, file_hash_sha256, transaction_unique_hash,
         redacted_file_url, status, fraud_risk_score, decision, decision_reason, decided_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        review.id,
        user.id,
        restaurant.id,
        's3://trustbite-invoices/receipts/receipt-proof-fields.png',
        'c'.repeat(64),
        'd'.repeat(64),
        's3://trustbite-invoices/receipts/receipt-proof-fields-redacted.png',
        'VERIFIED',
        80,
        'VERIFIED',
        'Sensitive receipt decision reason',
        user.id,
      ],
    );
    const otherReceipt = await query(
      `INSERT INTO receipt_verifications (
         review_id, user_id, restaurant_id, file_url, file_hash_sha256,
         status, decision, decision_reason, decided_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        otherReview.id,
        otherUser.id,
        restaurant.id,
        's3://trustbite-invoices/receipts/other-user-receipt.png',
        'e'.repeat(64),
        'VERIFIED',
        'VERIFIED',
        'Other receipt decision reason',
        user.id,
      ],
    );
    const otherMerchant = await query(
      `INSERT INTO merchants (user_id, business_name, status)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [otherUser.id, 'Other Merchant For Decider Ref', 'ACTIVE'],
    );
    const otherClaim = await query(
      `INSERT INTO restaurant_claims (merchant_id, restaurant_id, status, evidence_url, decided_by, admin_note)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        otherMerchant.rows[0].id,
        restaurant.id,
        'APPROVED',
        's3://trustbite-invoices/merchant-claims/other-claim-evidence.png',
        user.id,
        'Other claim admin note',
      ],
    );
    const userFraudFlag = await query(
      `INSERT INTO fraud_flags (flag_code, risk_score)
       VALUES ($1, $2)
       RETURNING id`,
      ['PRIVACY_TEST_USER_FLAG', 70],
    );
    const receiptFraudFlag = await query(
      `INSERT INTO fraud_flags (flag_code, risk_score)
       VALUES ($1, $2)
       RETURNING id`,
      ['PRIVACY_TEST_RECEIPT_FLAG', 75],
    );
    await query(
      `INSERT INTO fraud_flag_entities (fraud_flag_id, entity_type, entity_id)
       VALUES ($1, $2, $3)`,
      [userFraudFlag.rows[0].id, 'USER', user.id],
    );
    await query(
      `INSERT INTO fraud_flag_entities (fraud_flag_id, entity_type, entity_id)
       VALUES ($1, $2, $3)`,
      [receiptFraudFlag.rows[0].id, 'RECEIPT_VERIFICATION', receipt.rows[0].id],
    );
    await query(
      `INSERT INTO account_deletion_requests (user_id, reason, scheduled_deletion_at)
       VALUES ($1, $2, now() - interval '1 minute')`,
      [user.id, 'Sensitive receipt deletion reason'],
    );
    const identityProvider = {
      deleteUser: vi.fn().mockResolvedValue({ deleted: true, signedOut: true }),
    };
    const objectStorage = {
      deleteOwnedObject: vi.fn().mockResolvedValue({ deleted: true }),
    };

    try {
      const result = await processDueAccountDeletions({
        batchSize: 1,
        identityProvider,
        objectStorage,
      });

      expect(result).toMatchObject({ processed: 1, completed: 1, failed: 0 });
      const reviewRows = await query(
        `SELECT food_rating, price_rating, service_rating, ambience_rating, verification_status, visited_at
         FROM reviews
         WHERE id = $1`,
        [review.id],
      );
      const receiptRows = await query(
        `SELECT file_hash_sha256, transaction_unique_hash, status, fraud_risk_score, decision, decision_reason, decided_by
         FROM receipt_verifications
         WHERE id = $1`,
        [receipt.rows[0].id],
      );
      const otherReceiptRows = await query(
        `SELECT file_hash_sha256, decision_reason, decided_by
         FROM receipt_verifications
         WHERE id = $1`,
        [otherReceipt.rows[0].id],
      );
      const otherClaimRows = await query(
        `SELECT evidence_url, admin_note, decided_by
         FROM restaurant_claims
         WHERE id = $1`,
        [otherClaim.rows[0].id],
      );
      const fraudRows = await query(
        `SELECT count(*)::int AS count
         FROM fraud_flag_entities
         WHERE (entity_type = 'USER' AND entity_id = $1)
            OR (entity_type = 'RECEIPT_VERIFICATION' AND entity_id = $2)`,
        [user.id, receipt.rows[0].id],
      );
      const deletionRequestRows = await query(
        `SELECT retained_data_reason
         FROM account_deletion_requests
         WHERE user_id = $1`,
        [user.id],
      );

      expect(reviewRows.rows[0]).toMatchObject({
        food_rating: 3,
        price_rating: 3,
        service_rating: 3,
        ambience_rating: 3,
        verification_status: 'DELETED',
        visited_at: null,
      });
      expect(receiptRows.rows[0]).toMatchObject({
        transaction_unique_hash: null,
        status: 'DELETED',
        fraud_risk_score: 0,
        decision: null,
        decision_reason: null,
        decided_by: null,
      });
      expect(receiptRows.rows[0].file_hash_sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(receiptRows.rows[0].file_hash_sha256).not.toBe('c'.repeat(64));
      expect(otherReceiptRows.rows[0]).toMatchObject({
        file_hash_sha256: 'e'.repeat(64),
        decision_reason: 'Other receipt decision reason',
        decided_by: null,
      });
      expect(otherClaimRows.rows[0]).toMatchObject({
        evidence_url: 's3://trustbite-invoices/merchant-claims/other-claim-evidence.png',
        admin_note: 'Other claim admin note',
        decided_by: null,
      });
      expect(fraudRows.rows[0].count).toBe(2);
      expect(deletionRequestRows.rows[0].retained_data_reason).toContain('fraud minimum');
    } finally {
      await cleanupUser(user.id);
      await cleanupUser(otherUser.id);
      await query('DELETE FROM restaurants WHERE id = $1', [restaurant.id]);
    }
  });
});
