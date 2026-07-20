import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import awsConfig from '../config/aws.js';

const DEFAULT_ALLOWED_PREFIXES = [
  'avatars/',
  'receipts/',
  'review-media/',
  'merchant-claims/',
  'restaurant-images/',
  'bill-scans/',
];

const normalizeHost = (value) => value.toLowerCase();

const normalizeKey = (value) => value.replace(/^\/+/, '');

const defaultAllowedHosts = ({ bucketName, region }) => [
  `${bucketName}.s3.amazonaws.com`,
  `${bucketName}.s3.${region}.amazonaws.com`,
  `s3.${region}.amazonaws.com`,
  'localhost:4566',
  '127.0.0.1:4566',
].filter(Boolean).map(normalizeHost);

const hasAllowedPrefix = (key, allowedPrefixes) => (
  allowedPrefixes.length === 0 || allowedPrefixes.some((prefix) => key.startsWith(prefix))
);

export class S3BucketConfigurationError extends Error {
  constructor(message = 'AWS_S3_BUCKET_NAME is required before deleting TrustBite-owned objects') {
    super(message);
    this.name = 'S3BucketConfigurationError';
    this.code = 'S3_BUCKET_CONFIG_MISSING';
  }
}

export function parseOwnedObjectUrl(value, {
  bucketName = awsConfig.s3.bucketName,
  region = awsConfig.region,
  allowedHosts = awsConfig.s3.allowedHosts ?? [],
  allowedPrefixes = awsConfig.s3.allowedPrefixes ?? [],
} = {}) {
  if (!value) {
    return { owned: false, reason: 'missing_url' };
  }

  if (!bucketName) {
    return { owned: false, reason: 'missing_bucket_config' };
  }

  const prefixes = allowedPrefixes.length > 0 ? allowedPrefixes : DEFAULT_ALLOWED_PREFIXES;

  if (value.startsWith('s3://')) {
    const parsed = new URL(value);
    const key = normalizeKey(parsed.pathname);
    if (parsed.hostname !== bucketName || !key || !hasAllowedPrefix(key, prefixes)) {
      return { owned: false, reason: 'unowned_s3_uri' };
    }
    return { owned: true, bucket: bucketName, key };
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return { owned: false, reason: 'invalid_url' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { owned: false, reason: 'unsupported_protocol' };
  }

  const host = normalizeHost(parsed.host);
  const hosts = allowedHosts.length > 0
    ? allowedHosts.map(normalizeHost)
    : defaultAllowedHosts({ bucketName, region });
  if (!hosts.includes(host)) {
    return { owned: false, reason: 'unapproved_host' };
  }

  const virtualHostedPrefix = `${bucketName}.s3`;
  let key = normalizeKey(parsed.pathname);
  if (!host.startsWith(virtualHostedPrefix)) {
    const bucketPathPrefix = `${bucketName}/`;
    key = key.startsWith(bucketPathPrefix) ? key.slice(bucketPathPrefix.length) : '';
  }

  if (!key || !hasAllowedPrefix(key, prefixes)) {
    return { owned: false, reason: 'unapproved_prefix' };
  }

  return { owned: true, bucket: bucketName, key };
}

export class S3ObjectStorage {
  constructor({
    client = null,
    bucketName = awsConfig.s3.bucketName,
    region = awsConfig.region,
    allowedHosts = awsConfig.s3.allowedHosts ?? [],
    allowedPrefixes = awsConfig.s3.allowedPrefixes ?? [],
  } = {}) {
    this.client = client;
    this.bucketName = bucketName;
    this.region = region;
    this.allowedHosts = allowedHosts;
    this.allowedPrefixes = allowedPrefixes;
  }

  getClient() {
    if (!this.client) {
      this.client = new S3Client({
        region: this.region,
        endpoint: awsConfig.endpointUrl,
        forcePathStyle: awsConfig.s3.forcePathStyle,
        credentials: awsConfig.credentials,
      });
    }

    return this.client;
  }

  async deleteOwnedObject(url) {
    const parsed = parseOwnedObjectUrl(url, {
      bucketName: this.bucketName,
      region: this.region,
      allowedHosts: this.allowedHosts,
      allowedPrefixes: this.allowedPrefixes,
    });

    if (!parsed.owned) {
      if (parsed.reason === 'missing_bucket_config') {
        throw new S3BucketConfigurationError();
      }
      return { deleted: false, reason: parsed.reason };
    }

    await this.getClient().send(new DeleteObjectCommand({
      Bucket: parsed.bucket,
      Key: parsed.key,
    }));

    return { deleted: true };
  }
}

export const s3ObjectStorage = new S3ObjectStorage();
