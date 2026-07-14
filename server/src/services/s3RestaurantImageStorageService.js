import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'node:crypto';
import awsConfig from '../config/aws.js';
import { createHttpError } from '../utils/httpErrors.js';

const RESTAURANT_IMAGE_PREFIX = 'restaurant-images/';
const CACHE_CONTROL = 'public, max-age=31536000, immutable';
const OWNED_IMAGE_KEY_PATTERN = /^restaurant-images\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i;

const createS3Client = () => {
  const clientConfig = {
    region: awsConfig.region,
  };

  if (awsConfig.credentials) {
    clientConfig.credentials = awsConfig.credentials;
  }
  if (awsConfig.endpointUrl) {
    clientConfig.endpoint = awsConfig.endpointUrl;
  }
  if (awsConfig.s3.forcePathStyle !== undefined) {
    clientConfig.forcePathStyle = awsConfig.s3.forcePathStyle;
  }

  return new S3Client(clientConfig);
};

let s3Client = createS3Client();
let signUrl = getSignedUrl;

export function setS3RestaurantImageClientForTests(client) {
  s3Client = client;
}

export function resetS3RestaurantImageClientForTests() {
  s3Client = createS3Client();
}

export function setRestaurantImageSignerForTests(signer) {
  signUrl = signer;
}

export function resetRestaurantImageSignerForTests() {
  signUrl = getSignedUrl;
}

function requireProviderConfig() {
  const { bucketName } = awsConfig.restaurantImages;
  if (!bucketName) {
    throw createHttpError(
      503,
      'PROVIDER_UNAVAILABLE',
      'Restaurant image storage is not configured.',
    );
  }

  return { bucketName };
}

export function extensionForRestaurantImage(contentType) {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  return 'jpg';
}

export function buildRestaurantImageObjectKey({ restaurantId, contentType }) {
  const extension = extensionForRestaurantImage(contentType);
  return `${RESTAURANT_IMAGE_PREFIX}${restaurantId}/${crypto.randomUUID()}.${extension}`;
}

export async function uploadRestaurantImageObject({
  key,
  body,
  contentType,
}) {
  const { bucketName } = requireProviderConfig();

  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: CACHE_CONTROL,
    }));
  } catch {
    throw createHttpError(
      503,
      'PROVIDER_UNAVAILABLE',
      'Restaurant image storage provider is unavailable.',
    );
  }

  return {
    objectKey: key,
    imageReference: `s3://${bucketName}/${key}`,
  };
}

function legacyHttpsUrl(reference) {
  try {
    const parsed = new URL(reference);
    if (
      parsed.protocol === 'https:'
      && !parsed.username
      && !parsed.password
    ) {
      return parsed.href;
    }
  } catch {
    return null;
  }
  return null;
}

export async function resolveRestaurantImageUrl(reference) {
  if (typeof reference !== 'string' || !reference) return null;

  const legacyUrl = legacyHttpsUrl(reference);
  if (legacyUrl) return legacyUrl;

  const { bucketName } = requireProviderConfig();
  const referencePrefix = `s3://${bucketName}/`;
  if (!reference.startsWith(referencePrefix)) return null;

  const key = reference.slice(referencePrefix.length);
  if (!OWNED_IMAGE_KEY_PATTERN.test(key)) return null;

  try {
    return await signUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      }),
      { expiresIn: awsConfig.restaurantImages.signedUrlTtlSeconds },
    );
  } catch {
    throw createHttpError(
      503,
      'PROVIDER_UNAVAILABLE',
      'Restaurant image delivery provider is unavailable.',
    );
  }
}

export async function deleteRestaurantImageObject({ key }) {
  if (!key?.startsWith(RESTAURANT_IMAGE_PREFIX)) return;

  try {
    const { bucketName } = requireProviderConfig();
    await s3Client.send(new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    }));
  } catch {
    // Best-effort compensation only. The caller preserves the original error.
  }
}

export async function deleteRestaurantImageReference(reference) {
  if (typeof reference !== 'string' || !reference) return false;

  const { bucketName } = requireProviderConfig();
  const referencePrefix = `s3://${bucketName}/`;
  if (!reference.startsWith(referencePrefix)) return false;

  const key = reference.slice(referencePrefix.length);
  if (!OWNED_IMAGE_KEY_PATTERN.test(key)) return false;

  try {
    await s3Client.send(new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    }));
  } catch {
    throw createHttpError(
      503,
      'PROVIDER_UNAVAILABLE',
      'Restaurant image storage provider is unavailable.',
    );
  }

  return true;
}
