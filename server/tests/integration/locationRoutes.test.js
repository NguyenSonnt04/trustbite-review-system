import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createHttpError } from '../../src/utils/httpErrors.js';
import { errorMiddleware } from '../../src/middlewares/error.js';
import { createFixedWindowRateLimiter } from '../../src/middlewares/rateLimit.js';

vi.mock('../../src/services/locationService.js', () => ({
  searchPlaces: vi.fn(),
  reverseGeocode: vi.fn(),
  calculateRoute: vi.fn(),
}));

vi.mock('../../src/services/auth.js', () => ({
  authService: {
    authenticateRequest: vi.fn(),
  },
}));

const { createLocationRouter } = await import('../../src/routes/location.js');
const { authService } = await import('../../src/services/auth.js');
const locationService = await import('../../src/services/locationService.js');
const { requestApp } = await import('../helpers/http.js');

describe('location routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authService.authenticateRequest.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000001',
      status: 'ACTIVE',
      activeDeletionRequest: null,
    });
  });

  it('rejects unauthenticated paid-provider requests before calling AWS services', async () => {
    authService.authenticateRequest.mockRejectedValue(
      createHttpError(401, 'AUTH_REQUIRED', 'Bearer token is required'),
    );
    locationService.searchPlaces.mockResolvedValue({ items: [] });
    locationService.reverseGeocode.mockResolvedValue({ items: [] });
    locationService.calculateRoute.mockResolvedValue({ legs: [] });

    const requests = [
      requestApp().get('/api/v1/location/search').query({ q: 'Pho' }),
      requestApp().get('/api/v1/location/reverse-geocode').query({ lat: '10.77', lng: '106.69' }),
      requestApp().get('/api/v1/location/route').query({
        originLat: '10.77', originLng: '106.69', destLat: '10.78', destLng: '106.70',
      }),
    ];

    for (const pendingRequest of requests) {
      const response = await pendingRequest.expect(401);
      expect(response.body).toEqual({
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Bearer token is required',
        },
      });
    }

    expect(locationService.searchPlaces).not.toHaveBeenCalled();
    expect(locationService.reverseGeocode).not.toHaveBeenCalled();
    expect(locationService.calculateRoute).not.toHaveBeenCalled();
  });

  it('mounts authenticated search under /api/v1/location and returns normalized data', async () => {
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
    expect(authService.authenticateRequest).toHaveBeenCalledTimes(1);
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

  it('rate limits the shared paid-provider budget before calling the service', async () => {
    const app = express();
    app.use('/api/v1/location', createLocationRouter({
      rateLimiter: createFixedWindowRateLimiter({
        maxRequests: 1,
        windowMs: 60_000,
        code: 'LOCATION_RATE_LIMITED',
        message: 'Too many location requests; try again later',
      }),
    }));
    app.use(errorMiddleware);
    locationService.searchPlaces.mockResolvedValue({ items: [] });

    await request(app)
      .get('/api/v1/location/search')
      .query({ q: 'Pho' })
      .expect(200);

    const response = await request(app)
      .get('/api/v1/location/search')
      .query({ q: 'Pho' })
      .expect(429);

    expect(response.headers['retry-after']).toBe('60');
    expect(response.body).toEqual({
      error: {
        code: 'LOCATION_RATE_LIMITED',
        message: 'Too many location requests; try again later',
      },
    });
    expect(locationService.searchPlaces).toHaveBeenCalledTimes(1);
    expect(authService.authenticateRequest).toHaveBeenCalledTimes(1);
  });
});
