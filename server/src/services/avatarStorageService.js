import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'node:crypto';
import appConfig from '../config/app.js';
import awsConfig from '../config/aws.js';
import { parseOwnedObjectUrl } from './objectStorage.js';
import { createHttpError } from '../utils/httpErrors.js';

const AVATAR_CONTENT_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);
const MAX_AVATAR_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const DEFAULT_UPLOAD_EXPIRES_SECONDS = 900;

const defaultSigner = ({ client, command, expiresIn }) => getSignedUrl(client, command, { expiresIn });

const createS3Client = () => new S3Client({
  region: awsConfig.region,
  endpoint: awsConfig.s3.endpoint,
  forcePathStyle: awsConfig.s3.forcePathStyle,
  credentials: awsConfig.credentials,
});

let avatarUploadSigner = defaultSigner;

export function setAvatarUploadSignerForTests(signer) {
  avatarUploadSigner = signer;
}

export function resetAvatarUploadSignerForTests() {
  avatarUploadSigner = defaultSigner;
}

const validateFileSize = (value) => {
  if (!Number.isInteger(value) || value < 1 || value > MAX_AVATAR_FILE_SIZE_BYTES) {
    throw createHttpError(422, 'AVATAR_FILE_SIZE_INVALID', 'fileSizeBytes must be between 1 and 5242880');
  }
};

const buildCleanupCompatibleAvatarUrl = ({ host, bucketName, key }) => {
  const normalizedHost = host.toLowerCase();
  const virtualHostedPrefix = `${bucketName.toLowerCase()}.s3`;
  const path = normalizedHost.startsWith(virtualHostedPrefix)
    ? key
    : `${bucketName}/${key}`;

  return `https://${host}/${path}`;
};

const isOwnedAvatarKey = (key, userId) => {
  if (typeof key !== 'string' || typeof userId !== 'string') {
    return false;
  }
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) return false;
  const ownerPrefix = `avatars/${normalizedUserId}/`;
  return key.startsWith(ownerPrefix) && key.length > ownerPrefix.length;
};

const extractAvatarObjectKey = (avatarReference, bucketName) => {
  try {
    const parsed = new URL(avatarReference);
    const segments = parsed.pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));
    if (parsed.protocol !== 's3:' && bucketName && segments[0] === bucketName) {
      return segments.slice(1).join('/');
    }
    return segments.join('/');
  } catch {
    return null;
  }
};

const assertCleanupCompatibleAvatarUrl = (avatarUrl, {
  bucketName,
  region,
  allowedHosts,
  allowedPrefixes,
}) => {
  const parsed = parseOwnedObjectUrl(avatarUrl, {
    bucketName,
    region,
    allowedHosts,
    allowedPrefixes,
  });

  if (!parsed.owned) {
    throw createHttpError(
      503,
      'PROVIDER_UNAVAILABLE',
      'Avatar upload storage is not configured for account deletion cleanup.',
    );
  }
};

const normalizeUserId = (value) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw createHttpError(401, 'AUTH_REQUIRED', 'Authenticated user is required');
  }
  return value.trim();
};

export class AvatarUploadService {
  constructor({
    bucketName = awsConfig.s3.bucketName,
    avatarAllowedHosts = appConfig.avatarAllowedHosts,
    cleanupAllowedHosts = awsConfig.s3.allowedHosts ?? [],
    cleanupAllowedPrefixes = awsConfig.s3.allowedPrefixes ?? [],
    region = awsConfig.region,
    client = null,
    signer = null,
    readSigner = null,
    randomUuid = crypto.randomUUID,
    now = () => new Date(),
    expiresSeconds = DEFAULT_UPLOAD_EXPIRES_SECONDS,
    readExpiresSeconds = DEFAULT_UPLOAD_EXPIRES_SECONDS,
  } = {}) {
    this.bucketName = bucketName;
    this.avatarAllowedHosts = avatarAllowedHosts;
    this.cleanupAllowedHosts = cleanupAllowedHosts;
    this.cleanupAllowedPrefixes = cleanupAllowedPrefixes;
    this.region = region;
    this.client = client;
    this.signer = signer;
    this.readSigner = readSigner;
    this.randomUuid = randomUuid;
    this.now = now;
    this.expiresSeconds = expiresSeconds;
    this.readExpiresSeconds = readExpiresSeconds;
  }

  getClient() {
    if (!this.client) {
      this.client = createS3Client();
    }
    return this.client;
  }

  requireStorageConfig() {
    if (!this.bucketName || this.avatarAllowedHosts.length === 0) {
      throw createHttpError(503, 'PROVIDER_UNAVAILABLE', 'Avatar upload storage is not configured.');
    }
  }

  ownsAvatarReference(avatarReference, userId) {
    try {
      const parsed = parseOwnedObjectUrl(avatarReference, {
        bucketName: this.bucketName,
        region: this.region,
        allowedHosts: this.cleanupAllowedHosts,
        allowedPrefixes: ['avatars/'],
      });
      return parsed.owned && isOwnedAvatarKey(parsed.key, userId);
    } catch {
      return false;
    }
  }

  hasAvatarOwnerPath(avatarReference, userId) {
    return isOwnedAvatarKey(
      extractAvatarObjectKey(avatarReference, this.bucketName),
      userId,
    );
  }

  assertOwnedAvatarReference(avatarReference, userId) {
    if (!this.ownsAvatarReference(avatarReference, userId)) {
      throw createHttpError(
        422,
        'AVATAR_REFERENCE_NOT_OWNED',
        'Avatar URL must reference an upload owned by the current user.',
      );
    }
  }

  async createUploadUrl({ userId, contentType, fileSizeBytes }) {
    this.requireStorageConfig();
    const normalizedUserId = normalizeUserId(userId);
    const extension = AVATAR_CONTENT_TYPES.get(contentType);
    if (!extension) {
      throw createHttpError(422, 'AVATAR_CONTENT_TYPE_UNSUPPORTED', 'contentType must be image/jpeg, image/png, or image/webp');
    }
    validateFileSize(fileSizeBytes);

    const key = `avatars/${normalizedUserId}/${this.randomUuid()}.${extension}`;
    const avatarUrl = buildCleanupCompatibleAvatarUrl({
      host: this.avatarAllowedHosts[0],
      bucketName: this.bucketName,
      key,
    });
    assertCleanupCompatibleAvatarUrl(avatarUrl, {
      bucketName: this.bucketName,
      region: this.region,
      allowedHosts: this.cleanupAllowedHosts,
      allowedPrefixes: this.cleanupAllowedPrefixes,
    });
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
      ContentLength: fileSizeBytes,
    });
    const signer = this.signer ?? avatarUploadSigner;
    const uploadUrl = await signer({
      client: this.getClient(),
      command,
      expiresIn: this.expiresSeconds,
    });
    const expiresAt = new Date(this.now().getTime() + this.expiresSeconds * 1000).toISOString();

    return {
      uploadUrl,
      avatarUrl,
      expiresAt,
    };
  }

  async resolveReadUrl(avatarReference) {
    try {
      const parsed = parseOwnedObjectUrl(avatarReference, {
        bucketName: this.bucketName,
        region: this.region,
        allowedHosts: this.cleanupAllowedHosts,
        allowedPrefixes: ['avatars/'],
      });
      if (!parsed.owned) return null;

      const signer = this.readSigner ?? defaultSigner;
      return await signer({
        client: this.getClient(),
        command: new GetObjectCommand({
          Bucket: parsed.bucket,
          Key: parsed.key,
        }),
        expiresIn: this.readExpiresSeconds,
      });
    } catch {
      return null;
    }
  }
}

export const avatarUploadService = new AvatarUploadService();
