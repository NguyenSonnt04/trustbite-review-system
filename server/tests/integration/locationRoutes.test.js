import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHttpError } from '../../src/utils/httpErrors.js';

vi.mock('../../src/services/locationService.js', () => ({
  searchPlaces: vi.fn(),
  reverseGeocode: vi.fn(),
  calculateRoute: vi.fn(),
}));

const locationService = await import('../../src/services/locationService.js');
const { requestApp } = await import('../helpers/http.js');

describe('location routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mounts public search under /api/v1/location and returns normalized data', async () => {
    locationService.searchPlaces.mockResolvedValue({
      items: [{
        label: 'Pho Le',
        latitude: 10.77,
        longitude: 106.69,
        categories: ['Restaurant'],
      }],
    });

    const response = await requestApp()
      .get('/api/v1/location/search')
      .query({ q: 'Pho Le', lat: '10.77', lng: '106.69' })
      .expect(200);

    expect(response.body).toEqual({
      items: [{
        label: 'Pho Le',
        latitude: 10.77,
        longitude: 106.69,
        categories: ['Restaurant'],
      }],
    });
  });

  it('returns the standard validation envelope for malformed route coordinates', async () => {
    const response = await requestApp()
      .get('/api/v1/location/route')
      .query({
        originLat: '10abc', originLng: '106', destLat: '11', destLng: '107',
      })
      .expect(422);

    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: expect.any(String),
      },
    });
    expect(locationService.calculateRoute).not.toHaveBeenCalled();
  });

  it('returns a safe structured provider error without raw details', async () => {
    locationService.reverseGeocode.mockRejectedValue(createHttpError(
      503,
      'PROVIDER_UNAVAILABLE',
      'Location provider is unavailable',
    ));

    const response = await requestApp()
      .get('/api/v1/location/reverse-geocode')
      .query({ lat: '10.77', lng: '106.69' })
      .expect(503);

    expect(response.body).toEqual({
      error: {
        code: 'PROVIDER_UNAVAILABLE',
        message: 'Location provider is unavailable',
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('credential');
  });
});
