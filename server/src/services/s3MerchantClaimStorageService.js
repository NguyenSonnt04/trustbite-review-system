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

const CLAIM_PREFIX = 'receipts/merchant-claims/';
const UUID_SEGMENT = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const OWNED_CLAIM_KEY_PATTERN = new RegExp(
  `^receipts/merchant-claims/${UUID_SEGMENT}/${UUID_SEGMENT}/${UUID_SEGMENT}\\.(jpg|png|webp|pdf)$`,
  'i',
);

const createS3Client = () => {
  const clientConfig = {
    region: awsConfig.region,
  };
  if (awsConfig.credentials) clientConfig.credentials = awsConfig.credentials;
  if (awsConfig.endpointUrl) clientConfig.endpoint = awsConfig.endpointUrl;
  if (awsConfig.s3.forcePathStyle !== undefined) {
    clientConfig.forcePathStyle = awsConfig.s3.forcePathStyle;
  }
  return new S3Client(clientConfig);
};

let s3Client = createS3Client();
let signUrl = getSignedUrl;

export function setS3MerchantClaimClientForTests(client) {
  s3Client = client;
}

export function resetS3MerchantClaimClientForTests() {
  s3Client = createS3Client();
}

export function setMerchantClaimSignerForTests(signer) {
  signUrl = signer;
}

export function resetMerchantClaimSignerForTests() {
  signUrl = getSignedUrl;
}

function requireBucketName() {
  if (!awsConfig.s3.bucketName) {
    throw createHttpError(
      503,
      'PROVIDER_UNAVAILABLE',
      'Merchant claim storage is not configured.',
    );
  }
  return awsConfig.s3.bucketName;
}

function extensionForContentType(contentType) {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'application/pdf') return 'pdf';
  return 'jpg';
}

export function buildMerchantClaimObjectKey({
  merchantId,
  restaurantId,
  contentType,
}) {
  return `${CLAIM_PREFIX}${merchantId}/${restaurantId}/${crypto.randomUUID()}.${extensionForContentType(contentType)}`;
}

export async function uploadMerchantClaimObject({
  key,
  body,
  contentType,
}) {
  const bucketName = requireBucketName();
  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'private, no-store',
    }));
  } catch {
    throw createHttpError(
      503,
      'PROVIDER_UNAVAILABLE',
      'Merchant claim storage provider is unavailable.',
    );
  }
  return {
    objectKey: key,
    evidenceReference: `s3://${bucketName}/${key}`,
  };
}

export async function resolveMerchantClaimUrl(reference) {
  if (typeof reference !== 'string' || !reference) return null;
  const bucketName = requireBucketName();
  const prefix = `s3://${bucketName}/`;
  if (!reference.startsWith(prefix)) return null;

  const key = reference.slice(prefix.length);
  if (!OWNED_CLAIM_KEY_PATTERN.test(key)) return null;
  try {
    return await signUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
        ResponseContentDisposition: 'attachment',
      }),
      { expiresIn: awsConfig.merchantClaims.signedUrlTtlSeconds },
    );
  } catch {
    throw createHttpError(
      503,
      'PROVIDER_UNAVAILABLE',
      'Merchant claim delivery provider is unavailable.',
    );
  }
}

export async function deleteMerchantClaimObject({ key }) {
  if (!key?.startsWith(CLAIM_PREFIX)) return;
  try {
    const bucketName = requireBucketName();
    await s3Client.send(new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    }));
  } catch {
    // Compensation is best-effort so the original persistence error is preserved.
  }
}
