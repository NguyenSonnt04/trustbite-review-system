import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function loadOcrConfig(caseName) {
  vi.resetModules();
  const imports = {
    'redis-defaults': () => import('../../../src/config/ocr.js?redis-defaults'),
    'redis-tls': () => import('../../../src/config/ocr.js?redis-tls'),
  };
  return imports[caseName]();
}

describe('OCR config', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  it('does not enable Redis TLS unless requested', async () => {
    delete process.env.REDIS_TLS;

    const { getRedisConnection } = await loadOcrConfig('redis-defaults');

    expect(getRedisConnection()).not.toHaveProperty('tls');
  });

  it('enables Redis TLS for encrypted ElastiCache connections', async () => {
    process.env.REDIS_TLS = 'true';

    const { getRedisConnection } = await loadOcrConfig('redis-tls');

    expect(getRedisConnection()).toMatchObject({
      tls: {},
    });
  });
});
