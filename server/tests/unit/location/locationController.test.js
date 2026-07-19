import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/services/locationService.js', () => ({
  searchPlaces: vi.fn(),
  reverseGeocode: vi.fn(),
  calculateRoute: vi.fn(),
}));

const locationService = await import('../../../src/services/locationService.js');
const {
  searchPlacesHandler,
  reverseGeocodeHandler,
  calculateRouteHandler,
} = await import('../../../src/controllers/location.js');

const mockResponse = () => {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
};

const runHandler = async (handler, query) => {
  const req = { query };
  const res = mockResponse();
  const next = vi.fn();
  await handler(req, res, next);
  return { res, next };
};

const expectValidationFailure = ({ next }) => {
  expect(next).toHaveBeenCalledWith(expect.objectContaining({
    statusCode: 422,
    code: 'VALIDATION_ERROR',
  }));
};

describe('location controller boundary validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['missing', {}],
    ['blank', { q: '   ' }],
    ['non-string', { q: ['pho'] }],
    ['too long', { q: 'x'.repeat(201) }],
  ])('rejects a %s search query before calling the service', async (_name, query) => {
    const result = await runHandler(searchPlacesHandler, query);
    expectValidationFailure(result);
    expect(locationService.searchPlaces).not.toHaveBeenCalled();
  });

  it.each([
    ['partial latitude', { q: 'pho', lat: '10.7' }],
    ['partial longitude', { q: 'pho', lng: '106.7' }],
    ['trailing latitude text', { q: 'pho', lat: '10.7abc', lng: '106.7' }],
    ['leading longitude text', { q: 'pho', lat: '10.7', lng: 'x106.7' }],
    ['latitude range', { q: 'pho', lat: '90.01', lng: '106.7' }],
    ['longitude range', { q: 'pho', lat: '10.7', lng: '-180.01' }],
  ])('rejects invalid search bias: %s', async (_name, query) => {
    const result = await runHandler(searchPlacesHandler, query);
    expectValidationFailure(result);
    expect(locationService.searchPlaces).not.toHaveBeenCalled();
  });

  it('trims search text and parses a valid coordinate pair', async () => {
    locationService.searchPlaces.mockResolvedValue({ items: [] });

    const { res, next } = await runHandler(searchPlacesHandler, {
      q: '  banh mi  ',
      lat: '10.7725',
      lng: '106.6983',
    });

    expect(locationService.searchPlaces).toHaveBeenCalledWith('banh mi', {
      latitude: 10.7725,
      longitude: 106.6983,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ items: [] });
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    ['missing coordinate', { lat: '10' }],
    ['invalid latitude syntax', { lat: '10e1', lng: '106' }],
    ['invalid longitude syntax', { lat: '10', lng: '106.0.1' }],
    ['latitude out of range', { lat: '-91', lng: '106' }],
    ['longitude out of range', { lat: '10', lng: '181' }],
  ])('rejects reverse-geocode input: %s', async (_name, query) => {
    const result = await runHandler(reverseGeocodeHandler, query);
    expectValidationFailure(result);
    expect(locationService.reverseGeocode).not.toHaveBeenCalled();
  });

  it('calls reverse geocoding with parsed coordinates', async () => {
    locationService.reverseGeocode.mockResolvedValue({ place: null });
    const { res, next } = await runHandler(reverseGeocodeHandler, {
      lat: '10.77',
      lng: '106.69',
    });

    expect(locationService.reverseGeocode).toHaveBeenCalledWith(10.77, 106.69);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ place: null });
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    ['missing coordinate', {
      originLat: '10', originLng: '106', destLat: '11',
    }],
    ['malformed coordinate', {
      originLat: '10abc', originLng: '106', destLat: '11', destLng: '107',
    }],
    ['out-of-range coordinate', {
      originLat: '10', originLng: '106', destLat: '91', destLng: '107',
    }],
    ['unsupported mode', {
      originLat: '10', originLng: '106', destLat: '11', destLng: '107', mode: 'bicycle',
    }],
    ['non-string mode', {
      originLat: '10', originLng: '106', destLat: '11', destLng: '107', mode: ['car'],
    }],
  ])('rejects route input: %s', async (_name, query) => {
    const result = await runHandler(calculateRouteHandler, query);
    expectValidationFailure(result);
    expect(locationService.calculateRoute).not.toHaveBeenCalled();
  });

  it('defaults route mode to car and passes provider-neutral coordinates', async () => {
    locationService.calculateRoute.mockResolvedValue({ route: { geometry: [] } });
    const { res, next } = await runHandler(calculateRouteHandler, {
      originLat: '10.77',
      originLng: '106.69',
      destLat: '10.79',
      destLng: '106.71',
    });

    expect(locationService.calculateRoute).toHaveBeenCalledWith(
      { latitude: 10.77, longitude: 106.69 },
      { latitude: 10.79, longitude: 106.71 },
      'car',
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });
});
