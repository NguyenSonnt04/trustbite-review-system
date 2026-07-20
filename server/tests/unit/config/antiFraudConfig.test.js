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
    'bill-default': () => import('../../../src/config/antiFraud.js?bill-default'),
    'bill-env': () => import('../../../src/config/antiFraud.js?bill-env'),
    'bill-invalid': () => import('../../../src/config/antiFraud.js?bill-invalid'),
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

  it('defaults bill scan price tolerance to 1000 VND', async () => {
    delete process.env.BILL_SCAN_PRICE_TOLERANCE_VND;

    const config = await loadAntiFraudConfig('bill-default');

    expect(config.BILL_SCAN_PRICE_TOLERANCE_VND).toBe(1000);
  });

  it('parses bill scan price tolerance from environment', async () => {
    process.env.BILL_SCAN_PRICE_TOLERANCE_VND = '1500';

    const config = await loadAntiFraudConfig('bill-env');

    expect(config.BILL_SCAN_PRICE_TOLERANCE_VND).toBe(1500);
  });

  it.each(['-1', '1.5', 'Infinity', 'not-a-number'])(
    'rejects invalid bill scan price tolerance env value %s',
    async (value) => {
      process.env.BILL_SCAN_PRICE_TOLERANCE_VND = value;

      await expect(loadAntiFraudConfig('bill-invalid'))
        .rejects
        .toThrow(
          '[Config] BILL_SCAN_PRICE_TOLERANCE_VND must be a non-negative safe integer',
        );
    },
  );
});
