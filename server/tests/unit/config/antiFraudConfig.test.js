import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function loadAntiFraudConfig(caseName) {
  vi.resetModules();
  const imports = {
    'default-threshold': () => import('../../../src/config/antiFraud.js?default-threshold'),
    'env-threshold': () => import('../../../src/config/antiFraud.js?env-threshold'),
    'invalid-zero': () => import('../../../src/config/antiFraud.js?invalid-zero'),
    'invalid-negative': () => import('../../../src/config/antiFraud.js?invalid-negative'),
    'invalid-infinity': () => import('../../../src/config/antiFraud.js?invalid-infinity'),
    'invalid-nan': () => import('../../../src/config/antiFraud.js?invalid-nan'),
  };
  return imports[caseName]();
}

describe('anti-fraud config', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  it('defaults GPS proximity threshold to 200 meters', async () => {
    delete process.env.GPS_PROXIMITY_THRESHOLD_METERS;

    const config = await loadAntiFraudConfig('default-threshold');

    expect(config.GPS_PROXIMITY_THRESHOLD_METERS).toBe(200);
  });

  it('parses GPS proximity threshold from environment', async () => {
    process.env.GPS_PROXIMITY_THRESHOLD_METERS = '125.5';

    const config = await loadAntiFraudConfig('env-threshold');

    expect(config.GPS_PROXIMITY_THRESHOLD_METERS).toBe(125.5);
  });

  it.each([
    ['0', 'invalid-zero'],
    ['-1', 'invalid-negative'],
    ['Infinity', 'invalid-infinity'],
    ['not-a-number', 'invalid-nan'],
  ])('rejects invalid GPS proximity threshold env value %s', async (value, caseName) => {
    process.env.GPS_PROXIMITY_THRESHOLD_METERS = value;

    await expect(loadAntiFraudConfig(caseName))
      .rejects
      .toThrow('[Config] GPS_PROXIMITY_THRESHOLD_METERS must be a finite positive number');
  });
});
