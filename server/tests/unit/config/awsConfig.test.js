import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function loadAwsConfig(caseName) {
  vi.resetModules();
  const imports = {
    's3-allow-list': () => import('../../../src/config/aws.js?s3-allow-list'),
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
});
