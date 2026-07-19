import { describe, expect, it, vi } from 'vitest';
import { S3Client } from '@aws-sdk/client-s3';

import { AvatarUploadService } from '../../../src/services/avatarStorageService.js';
import { parseOwnedObjectUrl } from '../../../src/services/objectStorage.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OBJECT_ID = '22222222-2222-4222-8222-222222222222';

describe('avatar upload storage service', () => {
  it('accepts only avatar references owned by the current user', () => {
    const service = new AvatarUploadService({
      bucketName: 'trustbite-test-media',
      avatarAllowedHosts: ['cdn.trustbite.test'],
      cleanupAllowedHosts: ['cdn.trustbite.test'],
    });
    const ownedReference =
      `https://cdn.trustbite.test/trustbite-test-media/avatars/${USER_ID}/${OBJECT_ID}.png`;
    const foreignReference =
      `https://cdn.trustbite.test/trustbite-test-media/avatars/33333333-3333-4333-8333-333333333333/${OBJECT_ID}.png`;
    const nestedForeignReference =
      `https://cdn.trustbite.test/trustbite-test-media/avatars/33333333-3333-4333-8333-333333333333/avatars/${USER_ID}/${OBJECT_ID}.png`;

    expect(service.ownsAvatarReference(ownedReference, USER_ID)).toBe(true);
    expect(service.ownsAvatarReference(foreignReference, USER_ID)).toBe(false);
    expect(service.ownsAvatarReference(nestedForeignReference, USER_ID)).toBe(false);
    expect(service.hasAvatarOwnerPath(`s3://another-bucket/avatars/${USER_ID}/avatar.png`, USER_ID))
      .toBe(true);
    expect(service.hasAvatarOwnerPath(foreignReference, USER_ID)).toBe(false);
    expect(service.hasAvatarOwnerPath(nestedForeignReference, USER_ID)).toBe(false);
    let error;
    try {
      service.assertOwnedAvatarReference(foreignReference, USER_ID);
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({
      statusCode: 422,
      code: 'AVATAR_REFERENCE_NOT_OWNED',
    });
  });

  it('creates a short-lived signed read URL for an owned avatar object', async () => {
    const readSigner = vi.fn().mockResolvedValue(
      'https://cdn.trustbite.test/signed-avatar-read',
    );
    const service = new AvatarUploadService({
      bucketName: 'trustbite-test-media',
      avatarAllowedHosts: ['cdn.trustbite.test'],
      cleanupAllowedHosts: ['cdn.trustbite.test'],
      readSigner,
      client: { name: 's3-client' },
    });

    await expect(
      service.resolveReadUrl(
        `https://cdn.trustbite.test/trustbite-test-media/avatars/${USER_ID}/${OBJECT_ID}.png`,
      ),
    ).resolves.toBe('https://cdn.trustbite.test/signed-avatar-read');

    expect(readSigner).toHaveBeenCalledWith({
      client: { name: 's3-client' },
      command: expect.objectContaining({
        input: {
          Bucket: 'trustbite-test-media',
          Key: `avatars/${USER_ID}/${OBJECT_ID}.png`,
        },
      }),
      expiresIn: 900,
    });
  });

  it('returns null instead of exposing unowned or unavailable avatar URLs', async () => {
    const readSigner = vi.fn().mockRejectedValue(new Error('provider unavailable'));
    const service = new AvatarUploadService({
      bucketName: 'trustbite-test-media',
      avatarAllowedHosts: ['cdn.trustbite.test'],
      cleanupAllowedHosts: ['cdn.trustbite.test'],
      readSigner,
      client: { name: 's3-client' },
    });

    await expect(
      service.resolveReadUrl('https://untrusted.example/avatar.png'),
    ).resolves.toBeNull();
    await expect(service.resolveReadUrl('s3://[invalid')).resolves.toBeNull();
    await expect(
      service.resolveReadUrl(
        `https://cdn.trustbite.test/trustbite-test-media/avatars/${USER_ID}/${OBJECT_ID}.png`,
      ),
    ).resolves.toBeNull();
  });

  it('creates a short-lived signed upload URL for an allowlisted avatar object', async () => {
    const signer = vi.fn().mockResolvedValue('https://upload.trustbite.test/signed-avatar-url');
    const service = new AvatarUploadService({
      bucketName: 'trustbite-test-media',
      avatarAllowedHosts: ['cdn.trustbite.test'],
      cleanupAllowedHosts: ['cdn.trustbite.test'],
      signer,
      client: { name: 's3-client' },
      randomUuid: () => OBJECT_ID,
      now: () => new Date('2026-07-08T10:00:00.000Z'),
    });

    await expect(service.createUploadUrl({
      userId: USER_ID,
      contentType: 'image/png',
      fileSizeBytes: 1024,
    })).resolves.toEqual({
      uploadUrl: 'https://upload.trustbite.test/signed-avatar-url',
      avatarUrl: `https://cdn.trustbite.test/trustbite-test-media/avatars/${USER_ID}/${OBJECT_ID}.png`,
      expiresAt: '2026-07-08T10:15:00.000Z',
    });

    expect(signer).toHaveBeenCalledWith({
      client: { name: 's3-client' },
      command: expect.objectContaining({
        input: {
          Bucket: 'trustbite-test-media',
          Key: `avatars/${USER_ID}/${OBJECT_ID}.png`,
          ContentType: 'image/png',
          ContentLength: 1024,
        },
      }),
      expiresIn: 900,
    });
  });

  it('signs the advertised content length into the presigned PUT URL', async () => {
    const service = new AvatarUploadService({
      bucketName: 'trustbite-test-media',
      avatarAllowedHosts: ['cdn.trustbite.test'],
      cleanupAllowedHosts: ['cdn.trustbite.test'],
      client: new S3Client({
        region: 'ap-southeast-1',
        credentials: {
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key',
        },
      }),
      randomUuid: () => OBJECT_ID,
      now: () => new Date('2026-07-08T10:00:00.000Z'),
    });

    const upload = await service.createUploadUrl({
      userId: USER_ID,
      contentType: 'image/png',
      fileSizeBytes: 1024,
    });

    expect(new URL(upload.uploadUrl).searchParams.get('X-Amz-SignedHeaders')).toContain('content-length');
  });

  it('returns a cleanup-compatible avatar URL for path-style avatar hosts', async () => {
    const service = new AvatarUploadService({
      bucketName: 'trustbite-test-media',
      avatarAllowedHosts: ['localhost:4566'],
      signer: vi.fn().mockResolvedValue('https://upload.trustbite.test/signed-avatar-url'),
      client: { name: 's3-client' },
      randomUuid: () => OBJECT_ID,
      now: () => new Date('2026-07-08T10:00:00.000Z'),
    });

    const upload = await service.createUploadUrl({
      userId: USER_ID,
      contentType: 'image/webp',
      fileSizeBytes: 1024,
    });

    expect(upload.avatarUrl).toBe(
      `https://localhost:4566/trustbite-test-media/avatars/${USER_ID}/${OBJECT_ID}.webp`,
    );
    expect(parseOwnedObjectUrl(upload.avatarUrl, {
      bucketName: 'trustbite-test-media',
      allowedHosts: ['localhost:4566'],
      allowedPrefixes: ['avatars/'],
    })).toEqual({
      owned: true,
      bucket: 'trustbite-test-media',
      key: `avatars/${USER_ID}/${OBJECT_ID}.webp`,
    });
  });

  it('fails closed before signing when avatar host is not cleanup-allowlisted', async () => {
    const signer = vi.fn();
    const service = new AvatarUploadService({
      bucketName: 'trustbite-test-media',
      avatarAllowedHosts: ['cdn.trustbite.test'],
      cleanupAllowedHosts: [],
      signer,
      client: { name: 's3-client' },
      randomUuid: () => OBJECT_ID,
      now: () => new Date('2026-07-08T10:00:00.000Z'),
    });

    await expect(service.createUploadUrl({
      userId: USER_ID,
      contentType: 'image/webp',
      fileSizeBytes: 1024,
    })).rejects.toMatchObject({
      statusCode: 503,
      code: 'PROVIDER_UNAVAILABLE',
    });

    expect(signer).not.toHaveBeenCalled();
  });

  it.each([
    ['image/gif', 1024, 'AVATAR_CONTENT_TYPE_UNSUPPORTED'],
    ['image/png', undefined, 'AVATAR_FILE_SIZE_INVALID'],
    ['image/png', 0, 'AVATAR_FILE_SIZE_INVALID'],
    ['image/png', 5 * 1024 * 1024 + 1, 'AVATAR_FILE_SIZE_INVALID'],
  ])('rejects invalid avatar upload input %s %s', async (contentType, fileSizeBytes, code) => {
    const signer = vi.fn();
    const service = new AvatarUploadService({
      bucketName: 'trustbite-test-media',
      avatarAllowedHosts: ['cdn.trustbite.test'],
      signer,
    });

    await expect(service.createUploadUrl({
      userId: USER_ID,
      contentType,
      fileSizeBytes,
    })).rejects.toMatchObject({
      statusCode: 422,
      code,
    });
    expect(signer).not.toHaveBeenCalled();
  });

  it('fails closed when avatar storage configuration is missing', async () => {
    const signer = vi.fn();
    const service = new AvatarUploadService({
      bucketName: '',
      avatarAllowedHosts: [],
      signer,
    });

    await expect(service.createUploadUrl({
      userId: USER_ID,
      contentType: 'image/jpeg',
      fileSizeBytes: 1024,
    })).rejects.toMatchObject({
      statusCode: 503,
      code: 'PROVIDER_UNAVAILABLE',
    });
    expect(signer).not.toHaveBeenCalled();
  });
});
