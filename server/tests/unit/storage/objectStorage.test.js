import { describe, expect, it, vi } from 'vitest';

import {
  S3ObjectStorage,
  parseOwnedObjectUrl,
} from '../../../src/services/objectStorage.js';

describe('object storage cleanup', () => {
  it('parses configured TrustBite-owned S3 object URLs', () => {
    expect(parseOwnedObjectUrl('s3://trustbite-invoices/receipts/raw.png', {
      bucketName: 'trustbite-invoices',
      allowedPrefixes: ['receipts/'],
    })).toEqual({
      owned: true,
      bucket: 'trustbite-invoices',
      key: 'receipts/raw.png',
    });

    expect(parseOwnedObjectUrl('http://localhost:4566/trustbite-invoices/avatars/profile.png', {
      bucketName: 'trustbite-invoices',
      allowedPrefixes: ['avatars/'],
    })).toEqual({
      owned: true,
      bucket: 'trustbite-invoices',
      key: 'avatars/profile.png',
    });
  });

    it('refuses external hosts, buckets, and unapproved prefixes', () => {
    expect(parseOwnedObjectUrl('https://cdn.example.test/avatars/profile.png', {
      bucketName: 'trustbite-invoices',
      allowedPrefixes: ['avatars/'],
    })).toMatchObject({ owned: false, reason: 'unapproved_host' });

    expect(parseOwnedObjectUrl('s3://other-bucket/avatars/profile.png', {
      bucketName: 'trustbite-invoices',
      allowedPrefixes: ['avatars/'],
    })).toMatchObject({ owned: false, reason: 'unowned_s3_uri' });

      expect(parseOwnedObjectUrl('s3://trustbite-invoices/public/profile.png', {
        bucketName: 'trustbite-invoices',
        allowedPrefixes: ['avatars/'],
      })).toMatchObject({ owned: false, reason: 'unowned_s3_uri' });
    });

    it('treats non-empty object URLs as cleanup blockers when bucket config is missing', async () => {
      const send = vi.fn();
      const storage = new S3ObjectStorage({
        bucketName: '',
        client: { send },
      });

      expect(parseOwnedObjectUrl('s3://trustbite-invoices/receipts/raw.png', {
        bucketName: '',
      })).toMatchObject({ owned: false, reason: 'missing_bucket_config' });

      await expect(storage.deleteOwnedObject(
        's3://trustbite-invoices/receipts/raw.png',
      )).rejects.toMatchObject({
        name: 'S3BucketConfigurationError',
        code: 'S3_BUCKET_CONFIG_MISSING',
      });

      expect(send).not.toHaveBeenCalled();
    });

    it('sends DeleteObject only after ownership parsing succeeds', async () => {
    const send = vi.fn().mockResolvedValue({});
    const storage = new S3ObjectStorage({
      bucketName: 'trustbite-invoices',
      client: { send },
    });

    await expect(storage.deleteOwnedObject(
      's3://trustbite-invoices/review-media/review-photo.png',
    )).resolves.toEqual({ deleted: true });
    await expect(storage.deleteOwnedObject(
      'https://external.example.test/review-media/review-photo.png',
    )).resolves.toMatchObject({ deleted: false, reason: 'unapproved_host' });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].constructor.name).toBe('DeleteObjectCommand');
    expect(send.mock.calls[0][0].input).toEqual({
      Bucket: 'trustbite-invoices',
      Key: 'review-media/review-photo.png',
    });
  });
});
