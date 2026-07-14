import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function loadAwsConfig(caseName) {
  vi.resetModules();
  const imports = {
    's3-allow-list': () => import('../../../src/config/aws.js?s3-allow-list'),
    'localstack-s3-endpoint': () => import('../../../src/config/aws.js?localstack-s3-endpoint'),
  };
  return (await imports[caseName]()).default;
}

describe('AWS config', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  it('parses S3 owned-object allow lists from environment', async () => {
    process.env.TRUSTBITE_S3_ALLOWED_HOSTS = 'cdn.trustbite.test, localhost:4566';
    process.env.TRUSTBITE_S3_ALLOWED_PREFIXES = 'avatars/, receipts/';

    const config = await loadAwsConfig('s3-allow-list');

    expect(config.s3).toMatchObject({
      allowedHosts: ['cdn.trustbite.test', 'localhost:4566'],
      allowedPrefixes: ['avatars/', 'receipts/'],
    });
  });

  it('applies the LocalStack endpoint fallback to the S3 config boundary', async () => {
    delete process.env.AWS_ENDPOINT_URL;
    delete process.env.AWS_S3_FORCE_PATH_STYLE;
    process.env.LOCALSTACK_ENDPOINT_URL = 'http://127.0.0.1:4566';

    const config = await loadAwsConfig('localstack-s3-endpoint');

    expect(config.endpointUrl).toBe('http://127.0.0.1:4566');
    expect(config.s3).toMatchObject({
      endpoint: 'http://127.0.0.1:4566',
      forcePathStyle: true,
    });
  });
});
