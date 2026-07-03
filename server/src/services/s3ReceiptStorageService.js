import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import crypto from 'node:crypto';
import awsConfig from '../config/aws.js';
import { createHttpError } from '../utils/httpErrors.js';

const createS3Client = () => {
  const clientConfig = {
    region: awsConfig.region,
  };

  if (awsConfig.accessKeyId && awsConfig.secretAccessKey) {
    clientConfig.credentials = {
      accessKeyId: awsConfig.accessKeyId,
      secretAccessKey: awsConfig.secretAccessKey,
    };
  }

  if (awsConfig.s3.endpoint) {
    clientConfig.endpoint = awsConfig.s3.endpoint;
  }

  if (awsConfig.s3.forcePathStyle !== undefined) {
    clientConfig.forcePathStyle = awsConfig.s3.forcePathStyle;
  }

  return new S3Client(clientConfig);
};

let s3Client = createS3Client();

export function setS3ReceiptClientForTests(client) {
  s3Client = client;
}

export function resetS3ReceiptClientForTests() {
  s3Client = createS3Client();
}

function requireBucketName() {
  if (!awsConfig.s3.bucketName) {
    throw createHttpError(503, 'PROVIDER_UNAVAILABLE', 'Receipt storage bucket is not configured.');
  }

  return awsConfig.s3.bucketName;
}

export function extensionForContentType(contentType) {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/heic') return 'heic';
  if (contentType === 'image/heif') return 'heif';
  return 'jpg';
}

export function buildReceiptObjectKey({ userId, reviewId, contentType }) {
  const extension = extensionForContentType(contentType);
  const objectId = crypto.randomUUID();
  return `receipts/${userId}/${reviewId}/${objectId}.${extension}`;
}

export async function uploadReceiptObject({ key, body, contentType }) {
  const bucketName = requireBucketName();

  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    }));
  } catch (err) {
    throw createHttpError(503, 'PROVIDER_UNAVAILABLE', 'Receipt storage provider is unavailable.');
  }

  return `s3://${bucketName}/${key}`;
}

export async function deleteReceiptObject({ fileUrl }) {
  const bucketName = requireBucketName();
  const prefix = `s3://${bucketName}/`;
  if (!fileUrl?.startsWith(prefix)) return;

  const key = fileUrl.slice(prefix.length);
  try {
    await s3Client.send(new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    }));
  } catch {
    // Best-effort compensation only. The caller should still surface the original error.
  }
}
