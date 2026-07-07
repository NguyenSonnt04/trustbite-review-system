import { describe, expect, it } from 'vitest';

import { GPS_PROXIMITY_THRESHOLD_METERS } from '../../../src/config/antiFraud.js';
import {
  calculateHaversineDistanceMeters,
  evaluateGpsProximity,
} from '../../../src/services/verification/gpsProximityService.js';

describe('GPS proximity verification rule', () => {
  it('uses the anti-fraud config default threshold', () => {
    expect(GPS_PROXIMITY_THRESHOLD_METERS).toBe(200);
  });

  it('calculates zero meters for identical coordinate pairs', () => {
    const distance = calculateHaversineDistanceMeters(
      { latitude: 21.0336, longitude: 105.8453 },
      { latitude: 21.0336, longitude: 105.8453 },
    );

    expect(distance).toBe(0);
  });

  it('passes when user coordinates are inside the default threshold', () => {
    const result = evaluateGpsProximity({
      userLatitude: 21.0199,
      userLongitude: 105.8528,
      restaurantLatitude: 21.0200,
      restaurantLongitude: 105.8529,
    });

    expect(result.passed).toBe(true);
    expect(result.thresholdMeters).toBe(200);
    expect(result.distanceMeters).toBeGreaterThan(0);
    expect(result.distanceMeters).toBeLessThan(200);
  });

  it('returns a finite distance for nearly antipodal coordinates', () => {
    const distance = calculateHaversineDistanceMeters(
      { latitude: 76.373080725981, longitude: -159.06432376538876 },
      { latitude: -76.37308072594263, longitude: 20.935676234611236 },
    );

    expect(Number.isFinite(distance)).toBe(true);
    expect(distance).toBeGreaterThan(20_000_000);
  });

  it('passes at the exact threshold boundary', () => {
    const result = evaluateGpsProximity({
      userLatitude: 0,
      userLongitude: 0,
      restaurantLatitude: 0,
      restaurantLongitude: 0,
      thresholdMeters: 0.000001,
    });

    expect(result).toEqual({
      passed: true,
      distanceMeters: 0,
      thresholdMeters: 0.000001,
    });
  });

  it('fails when user coordinates are outside the default threshold', () => {
    const result = evaluateGpsProximity({
      userLatitude: 21.0400,
      userLongitude: 105.8600,
      restaurantLatitude: 21.0200,
      restaurantLongitude: 105.8529,
    });

    expect(result.passed).toBe(false);
    expect(result.thresholdMeters).toBe(200);
    expect(result.distanceMeters).toBeGreaterThan(200);
  });

  it('supports a custom positive threshold', () => {
    const result = evaluateGpsProximity({
      userLatitude: 21.0199,
      userLongitude: 105.8528,
      restaurantLatitude: 21.0200,
      restaurantLongitude: 105.8529,
      thresholdMeters: 10,
    });

    expect(result.passed).toBe(false);
    expect(result.thresholdMeters).toBe(10);
  });

  it.each([
    ['userLatitude', { userLatitude: 91 }],
    ['restaurantLatitude', { restaurantLatitude: -91 }],
    ['userLongitude', { userLongitude: 181 }],
    ['restaurantLongitude', { restaurantLongitude: -181 }],
    ['thresholdMeters', { thresholdMeters: 0 }],
    ['thresholdMeters', { thresholdMeters: -1 }],
    ['thresholdMeters', { thresholdMeters: Infinity }],
    ['thresholdMeters', { thresholdMeters: Number.NaN }],
  ])('rejects invalid %s values before producing a result', (_field, override) => {
    const input = {
      userLatitude: 21.0199,
      userLongitude: 105.8528,
      restaurantLatitude: 21.0200,
      restaurantLongitude: 105.8529,
      ...override,
    };

    expect(() => evaluateGpsProximity(input)).toThrow(/VALIDATION_ERROR/);
  });
});
