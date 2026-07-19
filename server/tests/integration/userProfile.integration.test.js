import '../helpers/env.js';
import crypto from 'node:crypto';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

process.env.TRUSTBITE_TRUSTED_AUTH_HEADERS = 'true';
process.env.TRUSTBITE_AVATAR_ALLOWED_HOSTS = 'localhost:4566,cdn.trustbite.test';
process.env.AWS_S3_BUCKET_NAME = 'trustbite-test-media';

const { default: appConfig } = await import('../../src/config/app.js');
const { cognitoIdentityProvider } = await import('../../src/services/identityProviders/cognitoProvider.js');
const {
  avatarUploadService,
  resetAvatarUploadSignerForTests,
  setAvatarUploadSignerForTests,
} = await import('../../src/services/avatarStorageService.js');
const { createUser } = await import('../helpers/factories/index.js');
const { closeDbPool, query } = await import('../helpers/db.js');
const { requestApp } = await import('../helpers/http.js');

const authHeaders = (userId) => ({
  'x-trustbite-user-id': userId,
});

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const cognitoKeyId = 'profile-integration-key';
const cognitoPublicJwk = {
  ...publicKey.export({ format: 'jwk' }),
  alg: 'RS256',
  kid: cognitoKeyId,
  use: 'sig',
};

const encodeJson = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

const createVietnameseTestPhone = () => (
  `09${crypto.randomInt(0, 100_000_000).toString().padStart(8, '0')}`
);

const toE164VietnamPhone = (value) => `+84${value.slice(1)}`;

const mapDateOnly = (value) => (
  value instanceof Date
    ? [
      value.getUTCFullYear().toString().padStart(4, '0'),
      (value.getUTCMonth() + 1).toString().padStart(2, '0'),
      value.getUTCDate().toString().padStart(2, '0'),
    ].join('-')
    : String(value).slice(0, 10)
);

function signCognitoAccessToken(subject) {
  const encodedHeader = encodeJson({ alg: 'RS256', kid: cognitoKeyId, typ: 'JWT' });
  const encodedPayload = encodeJson({
    sub: subject,
    iss: appConfig.auth.cognito.issuer,
    client_id: appConfig.auth.cognito.clientId,
    token_use: 'access',
    exp: Math.floor(Date.now() / 1000) + 300,
  });
  const signature = crypto
    .sign('RSA-SHA256', Buffer.from(`${encodedHeader}.${encodedPayload}`), privateKey)
    .toString('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

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
    vi.unstubAllGlobals();
    resetAvatarUploadSignerForTests();
  });

  afterAll(async () => {
    await closeDbPool();
  });

  it('returns and updates schema-backed profile fields for the current user', async () => {
    const user = await createUser({ displayName: 'Profile User' });
    const onboardingPhone = createVietnameseTestPhone();

    try {
      const getResponse = await requestApp()
        .get('/api/v1/users/me')
        .set(authHeaders(user.id))
        .expect(200);

      expect(getResponse.body).toMatchObject({
        id: user.id,
        phoneNumber: user.phone_number,
        displayName: 'Profile User',
        dateOfBirth: '1990-01-01',
        profileComplete: true,
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
          phoneNumber: onboardingPhone,
          dateOfBirth: '2004-11-20',
          avatarUrl: 'https://cdn.trustbite.test/avatars/profile-user.webp',
        })
        .expect(200);

      expect(patchResponse.body).toMatchObject({
        id: user.id,
        displayName: 'Updated Profile',
        phoneNumber: toE164VietnamPhone(onboardingPhone),
        dateOfBirth: '2004-11-20',
        profileComplete: true,
        avatarUrl: 'https://cdn.trustbite.test/avatars/profile-user.webp',
      });

      const persisted = await query(
        'SELECT display_name, phone_number, date_of_birth, avatar_url FROM users WHERE id = $1',
        [user.id],
      );
      expect(persisted.rows[0]).toMatchObject({
        display_name: 'Updated Profile',
        phone_number: toE164VietnamPhone(onboardingPhone),
        avatar_url: 'https://cdn.trustbite.test/avatars/profile-user.webp',
      });
      expect(mapDateOnly(persisted.rows[0].date_of_birth)).toBe('2004-11-20');
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('returns a signed display URL while preserving the owned avatar reference', async () => {
    const user = await createUser({ displayName: 'Avatar Display User' });
    const avatarReference =
      `https://localhost:4566/trustbite-test-media/avatars/${user.id}/profile.webp`;
    const signedAvatarUrl = 'https://signed.trustbite.test/avatar-read';
    vi.spyOn(avatarUploadService, 'resolveReadUrl').mockResolvedValue(signedAvatarUrl);

    try {
      const patchResponse = await requestApp()
        .patch('/api/v1/users/me')
        .set(authHeaders(user.id))
        .send({ avatarUrl: avatarReference })
        .expect(200);

      expect(patchResponse.body.avatarUrl).toBe(signedAvatarUrl);
      expect(avatarUploadService.resolveReadUrl).toHaveBeenCalledWith(avatarReference);

      const getResponse = await requestApp()
        .get('/api/v1/users/me')
        .set(authHeaders(user.id))
        .expect(200);

      expect(getResponse.body.avatarUrl).toBe(signedAvatarUrl);
      const persisted = await query('SELECT avatar_url FROM users WHERE id = $1', [user.id]);
      expect(persisted.rows[0].avatar_url).toBe(avatarReference);
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

  it('verifies a signed Cognito JWT before returning the mapped local profile', async () => {
    const user = await createUser({ displayName: 'Signed Cognito Profile User' });
    const cognitoSub = 'signed-profile-cognito-sub';
    await query('UPDATE users SET cognito_sub = $1 WHERE id = $2', [cognitoSub, user.id]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ keys: [cognitoPublicJwk] }),
    }));

    try {
      const response = await requestApp()
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${signCognitoAccessToken(cognitoSub)}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: user.id,
        displayName: 'Signed Cognito Profile User',
        status: 'ACTIVE',
      });
      expect(fetch).toHaveBeenCalledTimes(1);
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

  it('provisions a local profile for a new Cognito bearer identity', async () => {
    const cognitoSub = 'new-cognito-profile-sub';
    const onboardingPhone = createVietnameseTestPhone();
    mockCognitoIdentity({
      subject: cognitoSub,
      phoneNumber: null,
      phoneNumberVerified: false,
    });

    const response = await requestApp()
      .get('/api/v1/users/me')
      .set('Authorization', 'Bearer new-cognito-profile-token')
      .expect(200);

    try {
      expect(response.body).toMatchObject({
        phoneNumber: null,
        displayName: null,
        dateOfBirth: null,
        profileComplete: false,
        status: 'ACTIVE',
      });

      const completed = await requestApp()
        .patch('/api/v1/users/me')
        .set('Authorization', 'Bearer new-cognito-profile-token')
        .send({
          displayName: 'New Cognito User',
          dateOfBirth: '2000-06-15',
          phoneNumber: onboardingPhone,
        })
        .expect(200);

      expect(completed.body).toMatchObject({
        displayName: 'New Cognito User',
        dateOfBirth: '2000-06-15',
        phoneNumber: toE164VietnamPhone(onboardingPhone),
        profileComplete: true,
      });

      const persisted = await query(
        'SELECT cognito_sub, phone_number, date_of_birth FROM users WHERE id = $1',
        [response.body.id],
      );
      expect(persisted.rows[0]).toMatchObject({
        cognito_sub: cognitoSub,
        phone_number: toE164VietnamPhone(onboardingPhone),
      });
      expect(mapDateOnly(persisted.rows[0].date_of_birth)).toBe('2000-06-15');
    } finally {
      await cleanupUser(response.body.id);
    }
  });

  it('rejects invalid birth dates and phone numbers owned by another user', async () => {
    const owner = await createUser({ displayName: 'Phone Owner' });
    const user = await createUser({ displayName: 'Profile Conflict User' });

    try {
      const invalidDate = await requestApp()
        .patch('/api/v1/users/me')
        .set(authHeaders(user.id))
        .send({ dateOfBirth: '2025-02-29' })
        .expect(422);
      expect(invalidDate.body.error.code).toBe('VALIDATION_ERROR');

      const duplicatePhone = await requestApp()
        .patch('/api/v1/users/me')
        .set(authHeaders(user.id))
        .send({ phoneNumber: owner.phone_number })
        .expect(409);
      expect(duplicatePhone.body.error.code).toBe('PHONE_NUMBER_IN_USE');

      const persisted = await query(
        'SELECT phone_number, date_of_birth FROM users WHERE id = $1',
        [user.id],
      );
      expect(persisted.rows[0].phone_number).toBe(user.phone_number);
      expect(mapDateOnly(persisted.rows[0].date_of_birth)).toBe('1990-01-01');
    } finally {
      await cleanupUser(user.id);
      await cleanupUser(owner.id);
    }
  });

  it('rejects a protected profile request without a bearer token', async () => {
    const response = await requestApp()
      .get('/api/v1/users/me')
      .expect(401);

    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });

  it('rejects a malformed Cognito bearer token at the route boundary', async () => {
    const response = await requestApp()
      .get('/api/v1/users/me')
      .set('Authorization', 'Bearer malformed-token')
      .expect(401);

    expect(response.body.error.code).toBe('INVALID_TOKEN');
  });

  it.each([
    ['SUSPENDED', 'ACCOUNT_SUSPENDED'],
    ['DELETED', 'ACCOUNT_DELETED'],
  ])('rejects Cognito bearer authentication for %s users', async (status, errorCode) => {
    const user = await createUser({ displayName: `${status} Cognito User`, status });
    const cognitoSub = `${status.toLowerCase()}-cognito-sub`;
    await query('UPDATE users SET cognito_sub = $1 WHERE id = $2', [cognitoSub, user.id]);
    mockCognitoIdentity({ subject: cognitoSub });

    try {
      const response = await requestApp()
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${status.toLowerCase()}-profile-token`)
        .expect(403);

      expect(response.body.error.code).toBe(errorCode);
    } finally {
      await cleanupUser(user.id);
    }
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

  it('creates an avatar upload URL that can be persisted through profile PATCH', async () => {
    const user = await createUser({ displayName: 'Avatar Upload User' });
    const signer = vi.fn().mockResolvedValue('https://upload.trustbite.test/avatar-put-url');
    const signedReadUrl = 'https://signed.trustbite.test/avatar-read';
    const resolveReadUrl = vi
      .spyOn(avatarUploadService, 'resolveReadUrl')
      .mockResolvedValue(signedReadUrl);
    setAvatarUploadSignerForTests(signer);

    try {
      const response = await requestApp()
        .post('/api/v1/users/me/avatar-upload-url')
        .set(authHeaders(user.id))
        .send({
          contentType: 'image/webp',
          fileSizeBytes: 2048,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        uploadUrl: 'https://upload.trustbite.test/avatar-put-url',
      });
      expect(response.body.avatarUrl).toMatch(
        new RegExp(`^https://localhost:4566/trustbite-test-media/avatars/${user.id}/[0-9a-f-]+\\.webp$`),
      );
      expect(new Date(response.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
      expect(signer).toHaveBeenCalledWith(expect.objectContaining({
        command: expect.objectContaining({
          input: expect.objectContaining({
            Bucket: 'trustbite-test-media',
            ContentType: 'image/webp',
            ContentLength: 2048,
            Key: expect.stringMatching(new RegExp(`^avatars/${user.id}/[0-9a-f-]+\\.webp$`)),
          }),
        }),
        expiresIn: 900,
      }));

      const persisted = await query('SELECT avatar_url FROM users WHERE id = $1', [user.id]);
      expect(persisted.rows[0].avatar_url).toBeNull();

      const patchResponse = await requestApp()
        .patch('/api/v1/users/me')
        .set(authHeaders(user.id))
        .send({ avatarUrl: response.body.avatarUrl })
        .expect(200);

      expect(patchResponse.body.avatarUrl).toBe(signedReadUrl);
      expect(resolveReadUrl).toHaveBeenCalledWith(response.body.avatarUrl);

      const updated = await query('SELECT avatar_url FROM users WHERE id = $1', [user.id]);
      expect(updated.rows[0].avatar_url).toBe(response.body.avatarUrl);
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('rejects unsupported avatar upload content types before signing', async () => {
    const user = await createUser({ displayName: 'Invalid Avatar Upload User' });
    const signer = vi.fn();
    setAvatarUploadSignerForTests(signer);

    try {
      const response = await requestApp()
        .post('/api/v1/users/me/avatar-upload-url')
        .set(authHeaders(user.id))
        .send({
          contentType: 'image/gif',
          fileSizeBytes: 2048,
        })
        .expect(422);

      expect(response.body.error.code).toBe('AVATAR_CONTENT_TYPE_UNSUPPORTED');
      expect(signer).not.toHaveBeenCalled();
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('rejects avatar upload requests without a signed content length before signing', async () => {
    const user = await createUser({ displayName: 'Missing Avatar Size User' });
    const signer = vi.fn();
    setAvatarUploadSignerForTests(signer);

    try {
      const response = await requestApp()
        .post('/api/v1/users/me/avatar-upload-url')
        .set(authHeaders(user.id))
        .send({
          contentType: 'image/webp',
        })
        .expect(422);

      expect(response.body.error.code).toBe('AVATAR_FILE_SIZE_INVALID');
      expect(signer).not.toHaveBeenCalled();
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
