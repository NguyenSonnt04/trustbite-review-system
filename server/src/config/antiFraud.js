const DEFAULT_GPS_PROXIMITY_THRESHOLD_METERS = 200;

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

export const GPS_PROXIMITY_THRESHOLD_METERS = parsePositiveFiniteNumberEnv(
  'GPS_PROXIMITY_THRESHOLD_METERS',
  DEFAULT_GPS_PROXIMITY_THRESHOLD_METERS,
);
