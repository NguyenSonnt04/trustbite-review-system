const DEFAULT_GPS_PROXIMITY_THRESHOLD_METERS = 200;
const DEFAULT_BILL_SCAN_PRICE_TOLERANCE_VND = 1000;

function parsePositiveFiniteNumberEnv(name, defaultValue) {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue === '') {
    return defaultValue;
  }

  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    throw new Error(`[Config] ${name} must be a finite positive number`);
  }

  return parsedValue;
}

function parseNonNegativeIntegerEnv(name, defaultValue) {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue === '') {
    return defaultValue;
  }

  const parsedValue = Number(rawValue);
  if (!Number.isSafeInteger(parsedValue) || parsedValue < 0) {
    throw new Error(`[Config] ${name} must be a non-negative safe integer`);
  }

  return parsedValue;
}

export const GPS_PROXIMITY_THRESHOLD_METERS = parsePositiveFiniteNumberEnv(
  'GPS_PROXIMITY_THRESHOLD_METERS',
  DEFAULT_GPS_PROXIMITY_THRESHOLD_METERS,
);

export const BILL_SCAN_PRICE_TOLERANCE_VND = parseNonNegativeIntegerEnv(
  'BILL_SCAN_PRICE_TOLERANCE_VND',
  DEFAULT_BILL_SCAN_PRICE_TOLERANCE_VND,
);
