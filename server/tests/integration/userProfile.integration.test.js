import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, '../..');

dotenv.config({ path: path.join(serverRoot, '.env') });
process.env.AWS_COGNITO_USER_POOL_ID ??= 'local-test-pool';
process.env.AWS_COGNITO_CLIENT_ID ??= 'local-test-client';
process.env.AWS_REGION ??= 'us-east-1';
// Keep the key present so helper dotenv loads cannot rehydrate it from local .env.
process.env.AUTH_PHONE_FALLBACK_ENABLED = '';
process.env.TRUSTBITE_TRUSTED_AUTH_HEADERS = 'true';
process.env.TRUSTBITE_AVATAR_ALLOWED_HOSTS = 'cdn.trustbite.test';

const { cognitoIdentityProvider } = await import('../../src/services/identityProviders/cognitoProvider.js');
const { createUser } = await import('../helpers/factories/index.js');
const { closeDbPool, query } = await import('../helpers/db.js');
const { requestApp } = await import('../helpers/http.js');

const authHeaders = (userId) => ({
  'x-trustbite-user-id': userId,
});

const mockCognitoIdentity = (identity) => vi
  .spyOn(cognitoIdentityProvider, 'verifyAccessToken')
  .mockResolvedValue({
    provider: 'cognito',
    subject: 'test-cognito-sub',
    phoneNumber: null,
    phoneNumberVerified: false,
    tokenUse: 'access',
    ...identity,
  });

async function cleanupUser(userId) {
  await query('DELETE FROM account_deletion_requests WHERE user_id = $1', [userId]);
  await query('DELETE FROM users WHERE id = $1', [userId]);
}

describe('current user profile API', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await closeDbPool();
  });

  it('returns and updates schema-backed profile fields for the current user', async () => {
    const user = await createUser({ displayName: 'Profile User' });

    try {
      const getResponse = await requestApp()
        .get('/api/v1/users/me')
        .set(authHeaders(user.id))
        .expect(200);

      expect(getResponse.body).toMatchObject({
        id: user.id,
        phoneNumber: user.phone_number,
        displayName: 'Profile User',
        avatarUrl: null,
        status: 'ACTIVE',
        expPoints: 0,
        rankCode: 'NEWBIE',
      });

      const patchResponse = await requestApp()
        .patch('/api/v1/users/me')
        .set(authHeaders(user.id))
        .send({
          displayName: 'Updated Profile',
          avatarUrl: 'https://cdn.trustbite.test/avatars/profile-user.webp',
        })
        .expect(200);

      expect(patchResponse.body).toMatchObject({
        id: user.id,
        displayName: 'Updated Profile',
        avatarUrl: 'https://cdn.trustbite.test/avatars/profile-user.webp',
      });

      const persisted = await query('SELECT display_name, avatar_url FROM users WHERE id = $1', [user.id]);
      expect(persisted.rows[0]).toMatchObject({
        display_name: 'Updated Profile',
        avatar_url: 'https://cdn.trustbite.test/avatars/profile-user.webp',
      });
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('maps a Cognito bearer subject to the local profile user', async () => {
    const user = await createUser({ displayName: 'Cognito Profile User' });
    await query('UPDATE users SET cognito_sub = $1 WHERE id = $2', ['profile-cognito-sub', user.id]);
    const verifyAccessToken = mockCognitoIdentity({
      subject: 'profile-cognito-sub',
      phoneNumber: user.phone_number,
      phoneNumberVerified: true,
    });

    try {
      const response = await requestApp()
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer route-profile-token')
        .expect(200);

      expect(verifyAccessToken).toHaveBeenCalledWith('route-profile-token');
      expect(response.body).toMatchObject({
        id: user.id,
        phoneNumber: user.phone_number,
        displayName: 'Cognito Profile User',
        status: 'ACTIVE',
      });
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('binds a verified-phone transition user through a Cognito bearer request', async () => {
    const user = await createUser({ displayName: 'Transition Profile User' });
    const verifyAccessToken = mockCognitoIdentity({
      subject: 'transition-cognito-sub',
      phoneNumber: user.phone_number,
      phoneNumberVerified: true,
    });

    try {
      expect(process.env.AUTH_PHONE_FALLBACK_ENABLED).toBe('');

      const response = await requestApp()
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer transition-profile-token')
        .expect(200);

      expect(verifyAccessToken).toHaveBeenCalledWith('transition-profile-token');
      expect(response.body).toMatchObject({
        id: user.id,
        phoneNumber: user.phone_number,
        displayName: 'Transition Profile User',
      });

      const persisted = await query('SELECT cognito_sub FROM users WHERE id = $1', [user.id]);
      expect(persisted.rows[0].cognito_sub).toBe('transition-cognito-sub');
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('rejects unmapped Cognito bearer identities at the route boundary', async () => {
    mockCognitoIdentity({
      subject: 'unmapped-cognito-sub',
      phoneNumber: '+849999999999',
      phoneNumberVerified: true,
    });

    const response = await requestApp()
      .get('/api/v1/users/me')
      .set('Authorization', 'Bearer unmapped-profile-token')
      .expect(401);

    expect(response.body.error.code).toBe('UNMAPPED_IDENTITY');
  });

  it('rejects arbitrary external avatar URLs', async () => {
    const user = await createUser({ displayName: 'Avatar User' });

    try {
      const response = await requestApp()
        .patch('/api/v1/users/me')
        .set(authHeaders(user.id))
        .send({ avatarUrl: 'https://example.com/avatar.png' })
        .expect(422);

      expect(response.body.error.code).toBe('AVATAR_ORIGIN_NOT_ALLOWED');

      const persisted = await query('SELECT avatar_url FROM users WHERE id = $1', [user.id]);
      expect(persisted.rows[0].avatar_url).toBeNull();
    } finally {
      await cleanupUser(user.id);
    }
  });

  it.each([
    ['SUSPENDED', 'ACCOUNT_SUSPENDED'],
    ['DELETED', 'ACCOUNT_DELETED'],
  ])('rejects profile updates for %s users', async (status, errorCode) => {
    const user = await createUser({ displayName: `${status} User`, status });

    try {
      const response = await requestApp()
        .patch('/api/v1/users/me')
        .set(authHeaders(user.id))
        .send({ displayName: 'Blocked Update' })
        .expect(403);

      expect(response.body.error.code).toBe(errorCode);
    } finally {
      await cleanupUser(user.id);
    }
  });
});
