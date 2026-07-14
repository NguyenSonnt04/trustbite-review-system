import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadService({
  bucketName = 'trustbite-private-evidence',
  signedUrlTtlSeconds = '900',
} = {}) {
  vi.resetModules();
  process.env.AWS_REGION = 'ap-southeast-1';
  if (bucketName == null) delete process.env.AWS_S3_BUCKET_NAME;
  else process.env.AWS_S3_BUCKET_NAME = bucketName;
  process.env.TRUSTBITE_MERCHANT_CLAIM_SIGNED_URL_TTL_SECONDS = signedUrlTtlSeconds;
  return import('../../src/services/s3MerchantClaimStorageService.js');
}

describe('S3 merchant claim storage service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('uploads private no-store evidence without an ACL', async () => {
    const service = await loadService();
    const send = vi.fn(async () => ({}));
    service.setS3MerchantClaimClientForTests({ send });

    const result = await service.uploadMerchantClaimObject({
      key: 'receipts/merchant-claims/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333/44444444-4444-4444-8444-444444444444.pdf',
      body: Buffer.from('%PDF-1.4'),
      contentType: 'application/pdf',
    });

    expect(result.evidenceReference).toMatch(/^s3:\/\/trustbite-private-evidence\/receipts\/merchant-claims\//);
    expect(send.mock.calls[0][0].input).toMatchObject({
      Bucket: 'trustbite-private-evidence',
      ContentType: 'application/pdf',
      CacheControl: 'private, no-store',
    });
    expect(send.mock.calls[0][0].input).not.toHaveProperty('ACL');
  });

  it('signs only evidence owned by the configured bucket and prefix', async () => {
    const service = await loadService({ signedUrlTtlSeconds: '600' });
    const signer = vi.fn(async () => 'https://signed.test/evidence?X-Amz-Signature=claim');
    service.setMerchantClaimSignerForTests(signer);
    const reference = 's3://trustbite-private-evidence/receipts/merchant-claims/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333/44444444-4444-4444-8444-444444444444.pdf';

    await expect(service.resolveMerchantClaimUrl(reference))
      .resolves.toContain('X-Amz-Signature=claim');
    await expect(service.resolveMerchantClaimUrl(
      reference.replace('trustbite-private-evidence', 'foreign-bucket'),
    )).resolves.toBeNull();
    await expect(service.resolveMerchantClaimUrl(
      's3://trustbite-private-evidence/receipts/user/review/file.pdf',
    )).resolves.toBeNull();

    expect(signer).toHaveBeenCalledTimes(1);
    expect(signer.mock.calls[0][1].input).toMatchObject({
      Bucket: 'trustbite-private-evidence',
      ResponseContentDisposition: 'attachment',
    });
    expect(signer.mock.calls[0][2]).toEqual({ expiresIn: 600 });
  });

  it('fails closed when evidence storage is not configured', async () => {
    const service = await loadService({ bucketName: null });
    service.setS3MerchantClaimClientForTests({ send: vi.fn() });

    await expect(service.uploadMerchantClaimObject({
      key: 'receipts/merchant-claims/merchant/restaurant/evidence.pdf',
      body: Buffer.from('%PDF-1.4'),
      contentType: 'application/pdf',
    })).rejects.toMatchObject({
      statusCode: 503,
      code: 'PROVIDER_UNAVAILABLE',
    });
  });
});
