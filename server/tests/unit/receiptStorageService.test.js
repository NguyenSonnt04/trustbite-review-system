import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadServiceWithBucket(bucketName = 'trustbite-private-receipts') {
  vi.resetModules();
  process.env.AWS_REGION = 'ap-southeast-1';
  if (bucketName == null) delete process.env.AWS_S3_BUCKET_NAME;
  else process.env.AWS_S3_BUCKET_NAME = bucketName;

  return import('../../src/services/s3ReceiptStorageService.js');
}

describe('s3 receipt storage service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('uploads receipt objects without public ACL fields and returns a private s3 url', async () => {
    const sentCommands = [];
    const service = await loadServiceWithBucket();
    service.setS3ReceiptClientForTests({
      send: vi.fn(async (command) => {
        sentCommands.push(command);
        return {};
      }),
    });

    const result = await service.uploadReceiptObject({
      key: 'receipts/user/review/object.jpg',
      body: Buffer.from('receipt-bytes'),
      contentType: 'image/jpeg',
    });

    expect(result).toBe('s3://trustbite-private-receipts/receipts/user/review/object.jpg');
    expect(sentCommands).toHaveLength(1);
    expect(sentCommands[0].input).toMatchObject({
      Bucket: 'trustbite-private-receipts',
      Key: 'receipts/user/review/object.jpg',
      Body: Buffer.from('receipt-bytes'),
      ContentType: 'image/jpeg',
    });
    expect(sentCommands[0].input).not.toHaveProperty('ACL');
    expect(sentCommands[0].input).not.toHaveProperty('GrantRead');
  });

  it('fails closed when the receipt bucket is not configured', async () => {
    const service = await loadServiceWithBucket(null);
    service.setS3ReceiptClientForTests({
      send: vi.fn(async () => {
        throw new Error('should not send without a bucket');
      }),
    });

    await expect(service.uploadReceiptObject({
      key: 'receipts/user/review/object.jpg',
      body: Buffer.from('receipt-bytes'),
      contentType: 'image/jpeg',
    })).rejects.toMatchObject({
      statusCode: 503,
      code: 'PROVIDER_UNAVAILABLE',
    });
  });
});
