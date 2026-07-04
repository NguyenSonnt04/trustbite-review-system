import { GPS_PROXIMITY_THRESHOLD_METERS } from '../../config/antiFraud.js';

const EARTH_RADIUS_METERS = 6_371_000;

export class GpsProximityValidationError extends Error {
  constructor(message) {
    super(`VALIDATION_ERROR: ${message}`);
    this.name = 'GpsProximityValidationError';
    this.code = 'VALIDATION_ERROR';
  }
}

function assertFiniteNumber(name, value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new GpsProximityValidationError(`${name} must be a finite number.`);
  }
}

function assertLatitude(name, value) {
  assertFiniteNumber(name, value);
  if (value < -90 || value > 90) {
    throw new GpsProximityValidationError(`${name} must be between -90 and 90 degrees.`);
  }
}

function assertLongitude(name, value) {
  assertFiniteNumber(name, value);
  if (value < -180 || value > 180) {
    throw new GpsProximityValidationError(`${name} must be between -180 and 180 degrees.`);
  }
}

function assertThresholdMeters(value) {
  assertFiniteNumber('thresholdMeters', value);
  if (value <= 0) {
    throw new GpsProximityValidationError('thresholdMeters must be greater than 0.');
  }
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

export function calculateHaversineDistanceMeters(origin, destination) {
  assertLatitude('origin.latitude', origin?.latitude);
  assertLongitude('origin.longitude', origin?.longitude);
  assertLatitude('destination.latitude', destination?.latitude);
  assertLongitude('destination.longitude', destination?.longitude);

  if (origin.latitude === destination.latitude && origin.longitude === destination.longitude) {
    return 0;
  }

  const originLatitudeRadians = toRadians(origin.latitude);
  const destinationLatitudeRadians = toRadians(destination.latitude);
  const deltaLatitudeRadians = toRadians(destination.latitude - origin.latitude);
  const deltaLongitudeRadians = toRadians(destination.longitude - origin.longitude);

  const haversine = Math.sin(deltaLatitudeRadians / 2) ** 2
    + Math.cos(originLatitudeRadians)
    * Math.cos(destinationLatitudeRadians)
    * Math.sin(deltaLongitudeRadians / 2) ** 2;
  const normalizedHaversine = Math.min(1, Math.max(0, haversine));

  const centralAngle = 2 * Math.atan2(
    Math.sqrt(normalizedHaversine),
    Math.sqrt(1 - normalizedHaversine),
  );
  return EARTH_RADIUS_METERS * centralAngle;
}

export function evaluateGpsProximity({
  userLatitude,
  userLongitude,
  restaurantLatitude,
  restaurantLongitude,
  thresholdMeters = GPS_PROXIMITY_THRESHOLD_METERS,
}) {
  assertThresholdMeters(thresholdMeters);

  const distanceMeters = calculateHaversineDistanceMeters(
    { latitude: userLatitude, longitude: userLongitude },
    { latitude: restaurantLatitude, longitude: restaurantLongitude },
  );

  return {
    passed: distanceMeters <= thresholdMeters,
    distanceMeters,
    thresholdMeters,
  };
}
