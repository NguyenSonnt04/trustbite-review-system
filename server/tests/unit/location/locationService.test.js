import { describe, expect, it, vi } from 'vitest';
import { LocationService } from '../../../src/services/locationService.js';

const configuredResources = {
  placeIndexName: 'place-index-from-env',
  routeCalculatorName: 'route-calculator-from-env',
};

describe('LocationService', () => {
  it('does not retain the mobile map API key in service state', () => {
    const service = new LocationService({
      config: {
        ...configuredResources,
        region: 'ap-southeast-1',
        mapName: 'mobile-map',
        mapApiKey: 'mobile-map-secret',
      },
      aws: {},
    });

    expect(service.config).toEqual(configuredResources);
    expect(JSON.stringify(service)).not.toContain('mobile-map-secret');
  });

  it('prefers Location-specific credentials over shared AWS credentials', () => {
    const locationCredentials = {
      accessKeyId: 'location-access-key',
      secretAccessKey: 'location-secret-key',
    };
    const service = new LocationService({
      config: { ...configuredResources, credentials: locationCredentials },
      aws: {
        region: 'ap-southeast-1',
        credentials: {
          accessKeyId: 'shared-access-key',
          secretAccessKey: 'shared-secret-key',
        },
      },
    });

    expect(service.clientOptions.credentials).toBe(locationCredentials);
  });

  it('sends a text-search command with an optional bias and normalizes places', async () => {
    const send = vi.fn().mockResolvedValue({
      Results: [{
        Place: {
          Label: 'Ben Thanh Market, Ho Chi Minh City',
          Geometry: { Point: [106.6983, 10.7725] },
          Country: 'VNM',
          Region: 'Ho Chi Minh',
          Municipality: 'District 1',
          Categories: ['Shopping'],
        },
      }],
    });
    const service = new LocationService({ client: { send }, config: configuredResources });

    await expect(service.searchPlaces('Ben Thanh', {
      latitude: 10.77,
      longitude: 106.69,
    })).resolves.toEqual({
      items: [{
        label: 'Ben Thanh Market, Ho Chi Minh City',
        latitude: 10.7725,
        longitude: 106.6983,
        country: 'VNM',
        region: 'Ho Chi Minh',
        municipality: 'District 1',
        categories: ['Shopping'],
      }],
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].constructor.name).toBe('SearchPlaceIndexForTextCommand');
    expect(send.mock.calls[0][0].input).toEqual({
      IndexName: 'place-index-from-env',
      Text: 'Ben Thanh',
      BiasPosition: [106.69, 10.77],
    });
  });

  it('returns a null reverse-geocode place when the provider has no match', async () => {
    const send = vi.fn().mockResolvedValue({ Results: [] });
    const service = new LocationService({ client: { send }, config: configuredResources });

    await expect(service.reverseGeocode(10.77, 106.69)).resolves.toEqual({ place: null });
    expect(send.mock.calls[0][0].constructor.name).toBe('SearchPlaceIndexForPositionCommand');
    expect(send.mock.calls[0][0].input).toEqual({
      IndexName: 'place-index-from-env',
      Position: [106.69, 10.77],
      MaxResults: 1,
    });
  });

  it('calculates a route and normalizes distance, duration, leg data, and geometry', async () => {
    const send = vi.fn().mockResolvedValue({
      Summary: { Distance: 1.25, DurationSeconds: 420 },
      Legs: [
        {
          Distance: 0.75,
          DurationSeconds: 260,
          StartPosition: [106.69, 10.77],
          EndPosition: [106.70, 10.78],
          Geometry: { LineString: [[106.69, 10.77], [106.70, 10.78]] },
        },
        {
          Distance: 0.5,
          DurationSeconds: 160,
          StartPosition: [106.70, 10.78],
          EndPosition: [106.71, 10.79],
          Geometry: { LineString: [[106.70, 10.78], [106.71, 10.79]] },
        },
      ],
    });
    const service = new LocationService({ client: { send }, config: configuredResources });

    await expect(service.calculateRoute(
      { latitude: 10.77, longitude: 106.69 },
      { latitude: 10.79, longitude: 106.71 },
      'walking',
    )).resolves.toEqual({
      route: {
        distanceMeters: 1250,
        durationSeconds: 420,
        geometry: [[106.69, 10.77], [106.70, 10.78], [106.71, 10.79]],
        legs: [
          {
            distanceMeters: 750,
            durationSeconds: 260,
            startPosition: [106.69, 10.77],
            endPosition: [106.70, 10.78],
            geometry: [[106.69, 10.77], [106.70, 10.78]],
          },
          {
            distanceMeters: 500,
            durationSeconds: 160,
            startPosition: [106.70, 10.78],
            endPosition: [106.71, 10.79],
            geometry: [[106.70, 10.78], [106.71, 10.79]],
          },
        ],
      },
    });

    expect(send.mock.calls[0][0].constructor.name).toBe('CalculateRouteCommand');
    expect(send.mock.calls[0][0].input).toEqual({
      CalculatorName: 'route-calculator-from-env',
      DeparturePosition: [106.69, 10.77],
      DestinationPosition: [106.71, 10.79],
      TravelMode: 'Walking',
      DistanceUnit: 'Kilometers',
      IncludeLegGeometry: true,
    });
  });

  it('fails closed with a structured error when a required resource is not configured', async () => {
    const send = vi.fn();
    const service = new LocationService({ client: { send }, config: {} });

    await expect(service.searchPlaces('pho')).rejects.toMatchObject({
      statusCode: 503,
      code: 'LOCATION_NOT_CONFIGURED',
      message: 'Location service is not configured',
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('maps provider failures without exposing raw provider details', async () => {
    const send = vi.fn().mockRejectedValue(Object.assign(
      new Error('secret provider payload and credentials'),
      { name: 'InternalServerException' },
    ));
    const service = new LocationService({ client: { send }, config: configuredResources });

    let caught;
    try {
      await service.reverseGeocode(10.77, 106.69);
    } catch (err) {
      caught = err;
    }

    expect(caught).toMatchObject({
      statusCode: 503,
      code: 'PROVIDER_UNAVAILABLE',
      message: 'Location provider is unavailable',
    });
    expect(JSON.stringify(caught)).not.toContain('secret provider payload');
    expect(caught.cause).toBeUndefined();
  });

  it('maps provider throttling to a stable rate-limit error', async () => {
    const send = vi.fn().mockRejectedValue({ name: 'ThrottlingException' });
    const service = new LocationService({ client: { send }, config: configuredResources });

    await expect(service.searchPlaces('pho')).rejects.toMatchObject({
      statusCode: 429,
      code: 'PROVIDER_RATE_LIMITED',
      message: 'Location provider is temporarily rate limited',
    });
  });
});
