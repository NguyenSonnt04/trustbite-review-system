import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function loadAppConfig(caseName) {
  vi.resetModules();
  const imports = {
    'phone-fallback-default': () => import('../../../src/config/app.js?phone-fallback-default'),
    'phone-fallback-test-default': () => import('../../../src/config/app.js?phone-fallback-test-default'),
    'phone-fallback-disabled': () => import('../../../src/config/app.js?phone-fallback-disabled'),
    'phone-fallback-production-default': () => import('../../../src/config/app.js?phone-fallback-production-default'),
    'phone-fallback-staging-default': () => import('../../../src/config/app.js?phone-fallback-staging-default'),
    'phone-fallback-production-opt-in': () => import('../../../src/config/app.js?phone-fallback-production-opt-in'),
    'phone-fallback-missing-node-env': () => import('../../../src/config/app.js?phone-fallback-missing-node-env'),
    'phone-fallback-empty-node-env': () => import('../../../src/config/app.js?phone-fallback-empty-node-env'),
    'trust-proxy-unset': () => import('../../../src/config/app.js?trust-proxy-unset'),
    'trust-proxy-true': () => import('../../../src/config/app.js?trust-proxy-true'),
    'trust-proxy-false': () => import('../../../src/config/app.js?trust-proxy-false'),
    'trust-proxy-hops': () => import('../../../src/config/app.js?trust-proxy-hops'),
    'trust-proxy-subnet': () => import('../../../src/config/app.js?trust-proxy-subnet'),
    'admin-web': () => import('../../../src/config/app.js?admin-web'),
    'location-rate-limit': () => import('../../../src/config/app.js?location-rate-limit'),
  };
  return (await imports[caseName]()).default;
}

function setBaseEnv() {
  process.env.AWS_COGNITO_USER_POOL_ID = 'local-test-pool';
  process.env.AWS_COGNITO_CLIENT_ID = 'local-test-client';
  process.env.AWS_REGION = 'us-east-1';
  delete process.env.AUTH_PHONE_FALLBACK_ENABLED;
}

describe('app auth config', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it.each([
    ['development', 'phone-fallback-default'],
    ['test', 'phone-fallback-test-default'],
  ])('enables verified-phone transition fallback by default in %s', async (env, caseName) => {
    setBaseEnv();
    process.env.NODE_ENV = env;

    await expect(loadAppConfig(caseName))
      .resolves
      .toMatchObject({
        auth: {
          phoneFallbackEnabled: true,
        },
      });
  });

  it.each([
    ['unset', undefined, 'phone-fallback-missing-node-env'],
    ['empty', '', 'phone-fallback-empty-node-env'],
  ])('keeps verified-phone transition fallback disabled by default when NODE_ENV is %s', async (_label, nodeEnv, caseName) => {
    setBaseEnv();
    if (nodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = nodeEnv;
    }

    await expect(loadAppConfig(caseName))
      .resolves
      .toMatchObject({
        env: 'development',
        auth: {
          phoneFallbackEnabled: false,
        },
      });
  });

  it('honors an explicit opt-out for verified-phone transition fallback', async () => {
    setBaseEnv();
    process.env.AUTH_PHONE_FALLBACK_ENABLED = 'false';

    await expect(loadAppConfig('phone-fallback-disabled'))
      .resolves
      .toMatchObject({
        auth: {
          phoneFallbackEnabled: false,
        },
      });
  });

  it.each([
    ['production', 'phone-fallback-production-default'],
    ['staging', 'phone-fallback-staging-default'],
  ])('keeps verified-phone transition fallback disabled by default in %s', async (env, caseName) => {
    setBaseEnv();
    process.env.NODE_ENV = env;
    process.env.ALLOWED_ORIGINS = 'https://trustbite.test';

    await expect(loadAppConfig(caseName))
      .resolves
      .toMatchObject({
        auth: {
          phoneFallbackEnabled: false,
        },
      });
  });

  it('honors explicit verified-phone transition fallback opt-in in production', async () => {
    setBaseEnv();
    process.env.NODE_ENV = 'production';
    process.env.ALLOWED_ORIGINS = 'https://trustbite.test';
    process.env.AUTH_PHONE_FALLBACK_ENABLED = 'true';

    await expect(loadAppConfig('phone-fallback-production-opt-in'))
      .resolves
      .toMatchObject({
        auth: {
          phoneFallbackEnabled: true,
        },
      });
  });
});

describe('app trust proxy config', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('defaults trust proxy to false when TRUST_PROXY is unset (safe no-proxy default)', async () => {
    setBaseEnv();
    delete process.env.TRUST_PROXY;
    await expect(loadAppConfig('trust-proxy-unset')).resolves.toMatchObject({ trustProxy: false });
  });

  it('parses the boolean forms', async () => {
    setBaseEnv();
    process.env.TRUST_PROXY = 'true';
    await expect(loadAppConfig('trust-proxy-true')).resolves.toMatchObject({ trustProxy: true });

    process.env.TRUST_PROXY = 'false';
    await expect(loadAppConfig('trust-proxy-false')).resolves.toMatchObject({ trustProxy: false });
  });

  it('parses a numeric hop count', async () => {
    setBaseEnv();
    process.env.TRUST_PROXY = '2';
    await expect(loadAppConfig('trust-proxy-hops')).resolves.toMatchObject({ trustProxy: 2 });
  });

  it('passes through a subnet/keyword string for Express', async () => {
    setBaseEnv();
    process.env.TRUST_PROXY = '10.0.0.0/8';
    await expect(loadAppConfig('trust-proxy-subnet')).resolves.toMatchObject({ trustProxy: '10.0.0.0/8' });
  });
});

describe('admin web auth config', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('parses admin web provider, session, and throttle settings', async () => {
    setBaseEnv();
    process.env.AWS_COGNITO_ADMIN_WEB_CLIENT_ID = 'admin-client';
    process.env.AWS_COGNITO_ADMIN_WEB_CLIENT_SECRET = 'admin-secret';
    process.env.ADMIN_WEB_BFF_SECRET = 'bff-secret';
    process.env.ADMIN_WEB_SESSION_KEY_SECRET = 'session-secret';
    process.env.ADMIN_WEB_SESSION_MAX_SECONDS = '600';
    process.env.ADMIN_LOGIN_RATE_LIMIT_MAX = '4';
    process.env.ADMIN_LOGIN_EMAIL_RATE_LIMIT_MAX = '15';
    process.env.ADMIN_LOGIN_RATE_LIMIT_WINDOW_SECONDS = '240';

    await expect(loadAppConfig('admin-web')).resolves.toMatchObject({
      auth: {
        adminWeb: {
          cognitoClientId: 'admin-client',
          cognitoClientSecret: 'admin-secret',
          bffSecret: 'bff-secret',
          sessionKeySecret: 'session-secret',
          sessionMaxSeconds: 600,
          loginRateLimitMax: 4,
          loginEmailRateLimitMax: 15,
          loginRateLimitWindowSeconds: 240,
        },
      },
    });
  });
});

describe('Location API rate-limit config', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('parses the shared per-IP Location quota', async () => {
    setBaseEnv();
    process.env.AWS_LOCATION_RATE_LIMIT_MAX = '24';
    process.env.AWS_LOCATION_RATE_LIMIT_WINDOW_SECONDS = '120';

    await expect(loadAppConfig('location-rate-limit')).resolves.toMatchObject({
      location: {
        rateLimitMax: 24,
        rateLimitWindowMs: 120_000,
      },
    });
  });
});
