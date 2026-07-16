import '../helpers/env.js';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const originalTrustedAuthHeaders = process.env.TRUSTBITE_TRUSTED_AUTH_HEADERS;
const originalAvatarAllowedHosts = process.env.TRUSTBITE_AVATAR_ALLOWED_HOSTS;

let cognitoIdentityProvider;
let createUser;
let closeDbPool;
let query;
let requestApp;

const adminReason = 'Verified safety abuse case';

const authHeaders = (userId) => ({
  'x-trustbite-user-id': userId,
});

const createdRoleIds = new Set();

async function ensureRole(roleId) {
  const result = await query(
    `INSERT INTO roles (id, label, description)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    [roleId, roleId, `${roleId} test role`],
  );

  if (result.rowCount > 0) {
    createdRoleIds.add(roleId);
  }
}

async function assignRole(userId, roleId) {
  await ensureRole(roleId);
  await query(
    `INSERT INTO user_roles (user_id, role_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, role_id) DO NOTHING`,
    [userId, roleId],
  );
}

async function cleanupUsers(userIds) {
  if (userIds.length === 0) return;
  await query('DELETE FROM audit_logs WHERE actor_id = ANY($1::uuid[]) OR entity_id = ANY($1::uuid[])', [userIds]);
  await query('DELETE FROM account_deletion_requests WHERE user_id = ANY($1::uuid[])', [userIds]);
  await query('DELETE FROM user_sessions WHERE user_id = ANY($1::uuid[])', [userIds]);
  await query('DELETE FROM push_tokens WHERE user_id = ANY($1::uuid[])', [userIds]);
  await query('DELETE FROM user_roles WHERE user_id = ANY($1::uuid[])', [userIds]);
  await query('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]);
}

function restoreTestEnv() {
  if (originalTrustedAuthHeaders === undefined) {
    delete process.env.TRUSTBITE_TRUSTED_AUTH_HEADERS;
  } else {
    process.env.TRUSTBITE_TRUSTED_AUTH_HEADERS = originalTrustedAuthHeaders;
  }

  if (originalAvatarAllowedHosts === undefined) {
    delete process.env.TRUSTBITE_AVATAR_ALLOWED_HOSTS;
  } else {
    process.env.TRUSTBITE_AVATAR_ALLOWED_HOSTS = originalAvatarAllowedHosts;
  }
}

describe('admin user suspension API', () => {
  beforeAll(async () => {
    process.env.TRUSTBITE_TRUSTED_AUTH_HEADERS = 'true';
    process.env.TRUSTBITE_AVATAR_ALLOWED_HOSTS = 'cdn.trustbite.test';

    ({ cognitoIdentityProvider } = await import('../../src/services/identityProviders/cognitoProvider.js'));
    ({ createUser } = await import('../helpers/factories/index.js'));
    ({ closeDbPool, query } = await import('../helpers/db.js'));
    ({ requestApp } = await import('../helpers/http.js'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    try {
      if (createdRoleIds.size > 0) {
        await query(
          `DELETE FROM roles r
           WHERE r.id = ANY($1::varchar[])
             AND NOT EXISTS (
               SELECT 1 FROM user_roles ur WHERE ur.role_id = r.id
             )`,
          [[...createdRoleIds]],
        );
      }
    } finally {
      restoreTestEnv();
      if (closeDbPool) {
        await closeDbPool();
      }
    }
  });

  it('suspends an active user, writes audit evidence, and invalidates local state', async () => {
    const admin = await createUser({ displayName: 'Local Admin' });
    const target = await createUser({ displayName: 'Suspend Target' });
    await assignRole(admin.id, 'ADMIN');

    const session = await query(
      `INSERT INTO user_sessions (user_id, refresh_token_hash, device_label, platform, expires_at)
       VALUES ($1, $2, $3, $4, now() + interval '1 day')
       RETURNING id`,
      [target.id, `session-hash-${target.id}`, 'phone', 'IOS'],
    );
    await query(
      `INSERT INTO push_tokens (user_id, platform, token_ciphertext, token_fingerprint, provider)
       VALUES ($1, $2, $3, $4, $5)`,
      [target.id, 'IOS', 'ciphertext', `fingerprint-${target.id}`, 'APNS'],
    );

    try {
      const suspendResponse = await requestApp()
        .post(`/api/v1/admin/users/${target.id}/suspend`)
        .set(authHeaders(admin.id))
        .send({ reason: adminReason })
        .expect(200);

      expect(suspendResponse.body).toMatchObject({
        userId: target.id,
        status: 'SUSPENDED',
        revokedSessions: 1,
      });
      expect(suspendResponse.body.auditLogId).toEqual(expect.any(String));

      const suspended = await query(
        `SELECT
           u.status,
           s.revoked_at,
           p.status AS push_status,
           a.action,
           a.actor_role,
           a.previous_status,
           a.new_status,
           a.reason,
           a.metadata
         FROM users u
         JOIN user_sessions s ON s.user_id = u.id
         JOIN push_tokens p ON p.user_id = u.id
         JOIN audit_logs a ON a.id = $2
         WHERE u.id = $1`,
        [target.id, suspendResponse.body.auditLogId],
      );
      expect(suspended.rowCount).toBe(1);
      expect(suspended.rows[0]).toMatchObject({
        status: 'SUSPENDED',
        push_status: 'INACTIVE',
        action: 'USER_SUSPEND',
        actor_role: 'ADMIN',
        previous_status: 'ACTIVE',
        new_status: 'SUSPENDED',
        reason: adminReason,
      });
      expect(suspended.rows[0].revoked_at).toBeTruthy();
      expect(suspended.rows[0].metadata).toMatchObject({ revokedSessions: 1 });

      const sessionAfter = await query('SELECT revoked_at FROM user_sessions WHERE id = $1', [session.rows[0].id]);
      expect(sessionAfter.rows[0].revoked_at).toBeTruthy();
    } finally {
      await cleanupUsers([admin.id, target.id]);
    }
  });

  it('rejects suspended profile mutations through trusted headers and Cognito bearer identity', async () => {
    const admin = await createUser({ displayName: 'Suspension Admin' });
    const target = await createUser({ displayName: 'Blocked Target' });
    await assignRole(admin.id, 'ADMIN');
    await query('UPDATE users SET cognito_sub = $1 WHERE id = $2', ['suspended-target-sub', target.id]);

    try {
      await requestApp()
        .post(`/api/v1/admin/users/${target.id}/suspend`)
        .set(authHeaders(admin.id))
        .send({ reason: adminReason })
        .expect(200);

      const blockedPatch = await requestApp()
        .patch('/api/v1/users/me')
        .set(authHeaders(target.id))
        .send({ displayName: 'Blocked Update' })
        .expect(403);
      expect(blockedPatch.body.error.code).toBe('ACCOUNT_SUSPENDED');

      const verifyAccessToken = vi.spyOn(cognitoIdentityProvider, 'verifyAccessToken').mockResolvedValue({
        provider: 'cognito',
        subject: 'suspended-target-sub',
        phoneNumber: null,
        phoneNumberVerified: false,
        tokenUse: 'access',
        claims: {},
      });
      const cognitoBlockedPatch = await requestApp()
        .patch('/api/v1/users/me')
        .set('Authorization', 'Bearer suspended-target-token')
        .send({ displayName: 'Still Blocked Update' })
        .expect(403);
      expect(verifyAccessToken).toHaveBeenCalledWith('suspended-target-token');
      expect(cognitoBlockedPatch.body.error.code).toBe('ACCOUNT_SUSPENDED');
    } finally {
      await cleanupUsers([admin.id, target.id]);
    }
  });

  it('reactivates a suspended user without restoring revoked sessions', async () => {
    const admin = await createUser({ displayName: 'Reactivation Admin' });
    const target = await createUser({ displayName: 'Reactivate Target', status: 'SUSPENDED' });
    await assignRole(admin.id, 'ADMIN');

    const session = await query(
      `INSERT INTO user_sessions (user_id, refresh_token_hash, device_label, platform, revoked_at, expires_at)
       VALUES ($1, $2, $3, $4, now() - interval '1 hour', now() + interval '1 day')
       RETURNING id, revoked_at`,
      [target.id, `reactivate-session-hash-${target.id}`, 'phone', 'IOS'],
    );

    try {
      const reactivateResponse = await requestApp()
        .post(`/api/v1/admin/users/${target.id}/reactivate`)
        .set(authHeaders(admin.id))
        .send({ reason: 'Appeal reviewed successfully' })
        .expect(200);
      expect(reactivateResponse.body).toMatchObject({
        userId: target.id,
        status: 'ACTIVE',
      });

      const reactivated = await query(
        `SELECT u.status, s.revoked_at, a.action, a.previous_status, a.new_status, a.reason
         FROM users u
         JOIN user_sessions s ON s.user_id = u.id
         JOIN audit_logs a ON a.id = $2
         WHERE u.id = $1`,
        [target.id, reactivateResponse.body.auditLogId],
      );
      expect(reactivated.rowCount).toBe(1);
      expect(reactivated.rows[0]).toMatchObject({
        status: 'ACTIVE',
        action: 'USER_REACTIVATE',
        previous_status: 'SUSPENDED',
        new_status: 'ACTIVE',
        reason: 'Appeal reviewed successfully',
      });
      expect(reactivated.rows[0].revoked_at).toBeTruthy();
      expect(reactivated.rows[0].revoked_at.getTime()).toBe(session.rows[0].revoked_at.getTime());
    } finally {
      await cleanupUsers([admin.id, target.id]);
    }
  });

  it('allows a SUPER_ADMIN from local user_roles to suspend and reactivate an ADMIN target', async () => {
    const superAdmin = await createUser({ displayName: 'Local Super Admin' });
    const adminTarget = await createUser({ displayName: 'Admin Target' });
    await assignRole(superAdmin.id, 'SUPER_ADMIN');
    await assignRole(adminTarget.id, 'ADMIN');

    try {
      const suspendResponse = await requestApp()
        .post(`/api/v1/admin/users/${adminTarget.id}/suspend`)
        .set(authHeaders(superAdmin.id))
        .send({ reason: adminReason })
        .expect(200);
      expect(suspendResponse.body).toMatchObject({
        userId: adminTarget.id,
        status: 'SUSPENDED',
      });

      const reactivateResponse = await requestApp()
        .post(`/api/v1/admin/users/${adminTarget.id}/reactivate`)
        .set(authHeaders(superAdmin.id))
        .send({ reason: 'Super admin appeal approval' })
        .expect(200);
      expect(reactivateResponse.body).toMatchObject({
        userId: adminTarget.id,
        status: 'ACTIVE',
      });

      const audits = await query(
        `SELECT action, actor_role, previous_status, new_status
         FROM audit_logs
         WHERE actor_id = $1 AND entity_id = $2
         ORDER BY created_at ASC`,
        [superAdmin.id, adminTarget.id],
      );
      expect(audits.rows).toEqual([
        expect.objectContaining({
          action: 'USER_SUSPEND',
          actor_role: 'SUPER_ADMIN',
          previous_status: 'ACTIVE',
          new_status: 'SUSPENDED',
        }),
        expect.objectContaining({
          action: 'USER_REACTIVATE',
          actor_role: 'SUPER_ADMIN',
          previous_status: 'SUSPENDED',
          new_status: 'ACTIVE',
        }),
      ]);
    } finally {
      await cleanupUsers([superAdmin.id, adminTarget.id]);
    }
  });

  it('rejects non-admin users and Cognito provider-group-only identities', async () => {
    const actor = await createUser({ displayName: 'Plain Actor' });
    const providerActor = await createUser({ displayName: 'Provider Group Actor' });
    const target = await createUser({ displayName: 'Protected Target' });
    await query('UPDATE users SET cognito_sub = $1 WHERE id = $2', ['provider-admin-sub', providerActor.id]);

    vi.spyOn(cognitoIdentityProvider, 'verifyAccessToken').mockResolvedValue({
      provider: 'cognito',
      subject: 'provider-admin-sub',
      phoneNumber: null,
      phoneNumberVerified: false,
      tokenUse: 'access',
      providerGroups: ['ADMIN', 'SUPER_ADMIN'],
      claims: { 'cognito:groups': ['ADMIN', 'SUPER_ADMIN'] },
    });

    try {
      const localResponse = await requestApp()
        .post(`/api/v1/admin/users/${target.id}/suspend`)
        .set(authHeaders(actor.id))
        .send({ reason: adminReason })
        .expect(403);
      expect(localResponse.body.error.code).toBe('FORBIDDEN');

      const providerResponse = await requestApp()
        .post(`/api/v1/admin/users/${target.id}/suspend`)
        .set('Authorization', 'Bearer provider-groups-only-token')
        .send({ reason: adminReason })
        .expect(403);
      expect(providerResponse.body.error.code).toBe('FORBIDDEN');
    } finally {
      await cleanupUsers([actor.id, providerActor.id, target.id]);
    }
  });

  it('enforces admin tier, deleted/self/status/reason business guards for suspend and reactivate', async () => {
    const admin = await createUser({ displayName: 'Tier Admin' });
    const superTarget = await createUser({ displayName: 'Super Target' });
    const deletedTarget = await createUser({ displayName: 'Deleted Target', status: 'DELETED' });
    const activeTarget = await createUser({ displayName: 'Active Target' });
    const suspendedTarget = await createUser({ displayName: 'Suspended Target', status: 'SUSPENDED' });
    await assignRole(admin.id, 'ADMIN');
    await assignRole(superTarget.id, 'SUPER_ADMIN');

    try {
      const tierSuspend = await requestApp()
        .post(`/api/v1/admin/users/${superTarget.id}/suspend`)
        .set(authHeaders(admin.id))
        .send({ reason: adminReason })
        .expect(403);
      expect(tierSuspend.body.error.code).toBe('INSUFFICIENT_ADMIN_TIER');

      const tierReactivate = await requestApp()
        .post(`/api/v1/admin/users/${superTarget.id}/reactivate`)
        .set(authHeaders(admin.id))
        .send({ reason: adminReason })
        .expect(403);
      expect(tierReactivate.body.error.code).toBe('INSUFFICIENT_ADMIN_TIER');

      const deletedSuspend = await requestApp()
        .post(`/api/v1/admin/users/${deletedTarget.id}/suspend`)
        .set(authHeaders(admin.id))
        .send({ reason: adminReason })
        .expect(400);
      expect(deletedSuspend.body.error.code).toBe('CANNOT_SUSPEND_DELETED_USER');

      const deletedReactivate = await requestApp()
        .post(`/api/v1/admin/users/${deletedTarget.id}/reactivate`)
        .set(authHeaders(admin.id))
        .send({ reason: adminReason })
        .expect(400);
      expect(deletedReactivate.body.error.code).toBe('CANNOT_REACTIVATE_DELETED_USER');

      const selfSuspend = await requestApp()
        .post(`/api/v1/admin/users/${admin.id}/suspend`)
        .set(authHeaders(admin.id))
        .send({ reason: adminReason })
        .expect(403);
      expect(selfSuspend.body.error.code).toBe('CANNOT_SUSPEND_SELF');

      const selfReactivate = await requestApp()
        .post(`/api/v1/admin/users/${admin.id}/reactivate`)
        .set(authHeaders(admin.id))
        .send({ reason: adminReason })
        .expect(403);
      expect(selfReactivate.body.error.code).toBe('CANNOT_REACTIVATE_SELF');

      const alreadySuspended = await requestApp()
        .post(`/api/v1/admin/users/${suspendedTarget.id}/suspend`)
        .set(authHeaders(admin.id))
        .send({ reason: adminReason })
        .expect(409);
      expect(alreadySuspended.body.error.code).toBe('USER_ALREADY_SUSPENDED');

      const notSuspended = await requestApp()
        .post(`/api/v1/admin/users/${activeTarget.id}/reactivate`)
        .set(authHeaders(admin.id))
        .send({ reason: adminReason })
        .expect(409);
      expect(notSuspended.body.error.code).toBe('USER_NOT_SUSPENDED');

      const reasonSuspend = await requestApp()
        .post(`/api/v1/admin/users/${activeTarget.id}/suspend`)
        .set(authHeaders(admin.id))
        .send({ reason: 'short' })
        .expect(422);
      expect(reasonSuspend.body.error.code).toBe('ADMIN_REASON_REQUIRED');

      const reasonReactivate = await requestApp()
        .post(`/api/v1/admin/users/${suspendedTarget.id}/reactivate`)
        .set(authHeaders(admin.id))
        .send({ reason: 'short' })
        .expect(422);
      expect(reasonReactivate.body.error.code).toBe('ADMIN_REASON_REQUIRED');

      const unknownFieldSuspend = await requestApp()
        .post(`/api/v1/admin/users/${activeTarget.id}/suspend`)
        .set(authHeaders(admin.id))
        .send({ reason: adminReason, unexpected: true })
        .expect(422);
      expect(unknownFieldSuspend.body.error.code).toBe('VALIDATION_ERROR');
    } finally {
      await cleanupUsers([admin.id, superTarget.id, deletedTarget.id, activeTarget.id, suspendedTarget.id]);
    }
  });
});
