import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadService({
  bucketName = 'trustbite-restaurant-images',
  signedUrlTtlSeconds = '900',
} = {}) {
  vi.resetModules();
  process.env.AWS_REGION = 'ap-southeast-1';

  if (bucketName == null) delete process.env.AWS_RESTAURANT_IMAGES_BUCKET_NAME;
  else process.env.AWS_RESTAURANT_IMAGES_BUCKET_NAME = bucketName;

  process.env.TRUSTBITE_RESTAURANT_IMAGE_SIGNED_URL_TTL_SECONDS = signedUrlTtlSeconds;
  delete process.env.TRUSTBITE_RESTAURANT_IMAGE_CDN_BASE_URL;

  return import('../../src/services/s3RestaurantImageStorageService.js');
}

describe('S3 restaurant image storage service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('uploads a private cacheable object and returns a stable S3 reference', async () => {
    const sentCommands = [];
    const service = await loadService();
    service.setS3RestaurantImageClientForTests({
      send: vi.fn(async (command) => {
        sentCommands.push(command);
        return {};
      }),
    });

    const result = await service.uploadRestaurantImageObject({
      key: 'restaurant-images/restaurant-id/object.webp',
      body: Buffer.from('image-bytes'),
      contentType: 'image/webp',
    });

    expect(result).toEqual({
      objectKey: 'restaurant-images/restaurant-id/object.webp',
      imageReference: 's3://trustbite-restaurant-images/restaurant-images/restaurant-id/object.webp',
    });
    expect(sentCommands[0].input).toMatchObject({
      Bucket: 'trustbite-restaurant-images',
      Key: 'restaurant-images/restaurant-id/object.webp',
      Body: Buffer.from('image-bytes'),
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    });
    expect(sentCommands[0].input).not.toHaveProperty('ACL');
  });

  it('signs only owned restaurant image references with the configured TTL', async () => {
    const service = await loadService({ signedUrlTtlSeconds: '600' });
    const signer = vi.fn(async () => 'https://signed-s3.test/object.jpg?X-Amz-Signature=test');
    service.setRestaurantImageSignerForTests(signer);
    service.setS3RestaurantImageClientForTests({ send: vi.fn() });

    const result = await service.resolveRestaurantImageUrl(
      's3://trustbite-restaurant-images/restaurant-images/22222222-2222-4222-8222-222222222222/44444444-4444-4444-8444-444444444444.jpg',
    );

    expect(result).toBe('https://signed-s3.test/object.jpg?X-Amz-Signature=test');
    expect(signer).toHaveBeenCalledTimes(1);
    expect(signer.mock.calls[0][1].input).toEqual({
      Bucket: 'trustbite-restaurant-images',
      Key: 'restaurant-images/22222222-2222-4222-8222-222222222222/44444444-4444-4444-8444-444444444444.jpg',
    });
    expect(signer.mock.calls[0][2]).toEqual({ expiresIn: 600 });
  });

  it('passes through legacy HTTPS URLs and hides foreign or malformed references', async () => {
    const service = await loadService();
    const signer = vi.fn();
    service.setRestaurantImageSignerForTests(signer);

    await expect(service.resolveRestaurantImageUrl(
      'https://images.trustbite.test/restaurant-images/legacy.jpg',
    )).resolves.toBe('https://images.trustbite.test/restaurant-images/legacy.jpg');
    await expect(service.resolveRestaurantImageUrl(
      's3://foreign-bucket/restaurant-images/22222222-2222-4222-8222-222222222222/44444444-4444-4444-8444-444444444444.jpg',
    )).resolves.toBeNull();
    await expect(service.resolveRestaurantImageUrl('http://example.test/image.jpg')).resolves.toBeNull();

    expect(signer).not.toHaveBeenCalled();
  });

  it('deletes only owned restaurant image keys', async () => {
    const sentCommands = [];
    const service = await loadService();
    service.setS3RestaurantImageClientForTests({
      send: vi.fn(async (command) => {
        sentCommands.push(command);
        return {};
      }),
    });

    await service.deleteRestaurantImageObject({
      key: 'restaurant-images/restaurant-id/object.jpg',
    });
    await service.deleteRestaurantImageObject({
      key: 'receipts/user/review/object.jpg',
    });

    expect(sentCommands).toHaveLength(1);
    expect(sentCommands[0].input).toMatchObject({
      Bucket: 'trustbite-restaurant-images',
      Key: 'restaurant-images/restaurant-id/object.jpg',
    });
  });

  it('fails closed when provider configuration is incomplete', async () => {
    const config = { bucketName: null };
    const service = await loadService(config);
    service.setS3RestaurantImageClientForTests({
      send: vi.fn(),
    });

    await expect(service.uploadRestaurantImageObject({
      key: 'restaurant-images/restaurant-id/object.jpg',
      body: Buffer.from('image-bytes'),
      contentType: 'image/jpeg',
    })).rejects.toMatchObject({
      statusCode: 503,
      code: 'PROVIDER_UNAVAILABLE',
    });

    await expect(service.deleteRestaurantImageObject({
      key: 'restaurant-images/restaurant-id/object.jpg',
    })).resolves.toBeUndefined();
  });
});
