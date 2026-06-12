import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { afterAll, describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, '../..');

dotenv.config({ path: path.join(serverRoot, '.env') });
process.env.AWS_COGNITO_USER_POOL_ID ??= 'local-test-pool';
process.env.AWS_COGNITO_CLIENT_ID ??= 'local-test-client';
process.env.AWS_REGION ??= 'us-east-1';
process.env.TRUSTBITE_TRUSTED_AUTH_HEADERS = 'true';

const { createUser } = await import('../helpers/factories/index.js');
const { closeDbPool, query } = await import('../helpers/db.js');
const { requestApp } = await import('../helpers/http.js');

const authHeaders = (userId) => ({
  'x-trustbite-user-id': userId,
});

async function cleanupUser(userId) {
  await query('DELETE FROM audit_logs WHERE actor_id = $1 OR entity_id IN (SELECT id FROM account_deletion_requests WHERE user_id = $1)', [userId]);
  await query('DELETE FROM account_deletion_requests WHERE user_id = $1', [userId]);
  await query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);
  await query('DELETE FROM push_tokens WHERE user_id = $1', [userId]);
  await query('DELETE FROM users WHERE id = $1', [userId]);
}

describe('user account deletion request API', () => {
  afterAll(async () => {
    await closeDbPool();
  });

  it('creates, exposes, rejects duplicates, blocks profile mutation, and cancels a deletion request', async () => {
    const user = await createUser({ displayName: 'Delete Me' });
    const session = await query(
      `INSERT INTO user_sessions (user_id, refresh_token_hash, device_label, platform, expires_at)
       VALUES ($1, $2, $3, $4, now() + interval '1 day')
       RETURNING id`,
      [user.id, 'session-hash', 'phone', 'IOS'],
    );
    const pushToken = await query(
      `INSERT INTO push_tokens (user_id, platform, token_ciphertext, token_fingerprint, provider)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [user.id, 'IOS', 'ciphertext', `fingerprint-${user.id}`, 'APNS'],
    );

    try {
      const createResponse = await requestApp()
        .post('/api/v1/users/me/deletion-request')
        .set(authHeaders(user.id))
        .send({
          confirmationText: 'XÓA TÀI KHOẢN',
          reason: 'Sensitive deletion reason',
        })
        .expect(202);

      expect(createResponse.body).toMatchObject({
        userId: user.id,
        status: 'REQUESTED',
        reason: 'Sensitive deletion reason',
      });

      const deletionRequestId = createResponse.body.deletionRequestId;
      expect(deletionRequestId).toEqual(expect.any(String));

      const persisted = await query(
        `SELECT
           u.deletion_requested_at,
           s.revoked_at,
           p.status AS push_status,
           a.reason AS audit_reason,
           a.metadata
         FROM users u
         JOIN user_sessions s ON s.user_id = u.id
         JOIN push_tokens p ON p.user_id = u.id
         JOIN audit_logs a ON a.entity_id = $2
         WHERE u.id = $1`,
        [user.id, deletionRequestId],
      );
      expect(persisted.rowCount).toBe(1);
      expect(persisted.rows[0].deletion_requested_at).toBeTruthy();
      expect(persisted.rows[0].revoked_at).toBeTruthy();
      expect(persisted.rows[0].push_status).toBe('INACTIVE');
      expect(persisted.rows[0].audit_reason).toBeNull();
      expect(persisted.rows[0].metadata).toMatchObject({
        revokedSessions: 1,
        inactivatedPushTokens: 1,
      });

      const statusResponse = await requestApp()
        .get('/api/v1/users/me/deletion-request')
        .set(authHeaders(user.id))
        .expect(200);
      expect(statusResponse.body).toMatchObject({
        deletionRequestId,
        status: 'REQUESTED',
      });

      const duplicateResponse = await requestApp()
        .post('/api/v1/users/me/deletion-request')
        .set(authHeaders(user.id))
        .send({ confirmationText: 'XÓA TÀI KHOẢN' })
        .expect(409);
      expect(duplicateResponse.body.error.code).toBe('DELETION_REQUEST_ALREADY_EXISTS');

      const patchResponse = await requestApp()
        .patch('/api/v1/users/me')
        .set(authHeaders(user.id))
        .send({ displayName: 'Changed Name' })
        .expect(409);
      expect(patchResponse.body.error.code).toBe('DELETION_REQUEST_ACTIVE');

      const cancelResponse = await requestApp()
        .post('/api/v1/users/me/deletion-request/cancel')
        .set(authHeaders(user.id))
        .expect(200);
      expect(cancelResponse.body).toMatchObject({
        deletionRequestId,
        status: 'CANCELLED',
      });

      const cancelled = await query(
        `SELECT
           u.deletion_requested_at,
           adr.status,
           adr.cancelled_at,
           a.reason AS audit_reason
         FROM users u
         JOIN account_deletion_requests adr ON adr.user_id = u.id
         JOIN audit_logs a ON a.entity_id = adr.id AND a.action = 'ACCOUNT_DELETION_CANCELLED'
         WHERE u.id = $1`,
        [user.id],
      );
      expect(cancelled.rowCount).toBe(1);
      expect(cancelled.rows[0].deletion_requested_at).toBeNull();
      expect(cancelled.rows[0].status).toBe('CANCELLED');
      expect(cancelled.rows[0].cancelled_at).toBeTruthy();
      expect(cancelled.rows[0].audit_reason).toBeNull();
    } finally {
      await cleanupUser(user.id);
    }
  });
});
