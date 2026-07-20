import crypto from 'node:crypto';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import awsConfig from '../config/aws.js';
import { createHttpError } from '../utils/httpErrors.js';

function createClient() {
  const config = {
    region: awsConfig.region,
    ...(awsConfig.credentials ? { credentials: awsConfig.credentials } : {}),
    ...(awsConfig.s3.endpoint ? { endpoint: awsConfig.s3.endpoint } : {}),
    ...(awsConfig.s3.forcePathStyle !== undefined
      ? { forcePathStyle: awsConfig.s3.forcePathStyle }
      : {}),
  };
  return new S3Client(config);
}

let s3Client = createClient();

export function setS3BillScanClientForTests(client) {
  s3Client = client;
}

export function resetS3BillScanClientForTests() {
  s3Client = createClient();
}

function requireBucket() {
  if (!awsConfig.s3.bucketName) {
    throw createHttpError(503, 'PROVIDER_UNAVAILABLE', 'Bill scan storage is unavailable.');
  }
  return awsConfig.s3.bucketName;
}

export function buildBillScanObjectKey({ userId, scanId, contentType }) {
  const extension = contentType === 'image/png' ? 'png' : 'jpg';
  return `bill-scans/${userId}/${scanId}/${crypto.randomUUID()}.${extension}`;
}

export async function uploadBillScanObject({ key, body, contentType }) {
  const bucket = requireBucket();
  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }));
  } catch {
    throw createHttpError(503, 'PROVIDER_UNAVAILABLE', 'Bill scan storage is unavailable.');
  }
  return `s3://${bucket}/${key}`;
}

async function deleteObject({ fileUrl, bestEffort }) {
  const bucket = requireBucket();
  const prefix = `s3://${bucket}/`;
  if (!fileUrl?.startsWith(prefix)) return;

  try {
    await s3Client.send(new DeleteObjectCommand({
      Bucket: bucket,
      Key: fileUrl.slice(prefix.length),
    }));
  } catch (error) {
    if (!bestEffort) {
      throw createHttpError(503, 'PROVIDER_UNAVAILABLE', 'Bill scan storage is unavailable.');
    }
  }
}

export function deleteBillScanObject({ fileUrl }) {
  return deleteObject({ fileUrl, bestEffort: true });
}

export function deleteBillScanObjectStrict({ fileUrl }) {
  return deleteObject({ fileUrl, bestEffort: false });
}
