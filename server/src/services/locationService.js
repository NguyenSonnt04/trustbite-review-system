import {
  CalculateRouteCommand,
  LocationClient,
  SearchPlaceIndexForPositionCommand,
  SearchPlaceIndexForTextCommand,
} from '@aws-sdk/client-location';
import awsConfig from '../config/aws.js';
import { createHttpError, HttpError } from '../utils/httpErrors.js';

const TRAVEL_MODES = Object.freeze({
  car: 'Car',
  truck: 'Truck',
  walking: 'Walking',
});

const ADDRESS_FIELDS = Object.freeze([
  ['country', 'Country'],
  ['region', 'Region'],
  ['subRegion', 'SubRegion'],
  ['municipality', 'Municipality'],
  ['neighborhood', 'Neighborhood'],
  ['postalCode', 'PostalCode'],
  ['street', 'Street'],
  ['addressNumber', 'AddressNumber'],
]);

const isPosition = (value) => (
  Array.isArray(value)
  && value.length >= 2
  && Number.isFinite(value[0])
  && Number.isFinite(value[1])
);

const copyPosition = (value) => (isPosition(value) ? [value[0], value[1]] : null);

const normalizePlace = (result) => {
  const place = result?.Place;
  const point = copyPosition(place?.Geometry?.Point);
  if (!place || typeof place.Label !== 'string' || !place.Label || !point) {
    return null;
  }

  const normalized = {
    label: place.Label,
    latitude: point[1],
    longitude: point[0],
  };

  for (const [dtoField, providerField] of ADDRESS_FIELDS) {
    if (typeof place[providerField] === 'string' && place[providerField]) {
      normalized[dtoField] = place[providerField];
    }
  }

  normalized.categories = Array.isArray(place.Categories)
    ? place.Categories.filter((category) => typeof category === 'string')
    : [];

  return normalized;
};

const normalizePlaces = (results) => (Array.isArray(results) ? results : [])
  .map(normalizePlace)
  .filter(Boolean);

const kilometersToMeters = (distance) => (
  Number.isFinite(distance) ? Math.round(distance * 1000) : 0
);

const normalizeLineString = (lineString) => (Array.isArray(lineString) ? lineString : [])
  .map(copyPosition)
  .filter(Boolean);

const normalizeLeg = (leg) => ({
  distanceMeters: kilometersToMeters(leg?.Distance),
  durationSeconds: Number.isFinite(leg?.DurationSeconds) ? leg.DurationSeconds : 0,
  startPosition: copyPosition(leg?.StartPosition),
  endPosition: copyPosition(leg?.EndPosition),
  geometry: normalizeLineString(leg?.Geometry?.LineString),
});

const mergeLegGeometry = (legs) => legs.reduce((geometry, leg) => {
  for (const position of leg.geometry) {
    const previous = geometry.at(-1);
    if (!previous || previous[0] !== position[0] || previous[1] !== position[1]) {
      geometry.push(position);
    }
  }
  return geometry;
}, []);

const providerError = (err) => {
  if (err instanceof HttpError) return err;
  if (['ThrottlingException', 'TooManyRequestsException'].includes(err?.name)) {
    return createHttpError(
      429,
      'PROVIDER_RATE_LIMITED',
      'Location provider is temporarily rate limited',
    );
  }
  return createHttpError(503, 'PROVIDER_UNAVAILABLE', 'Location provider is unavailable');
};

export class LocationService {
  constructor({ client = null, config = awsConfig.location, aws = awsConfig } = {}) {
    this.client = client;
    this.config = config ?? {};
    this.clientOptions = {
      region: this.config.region || aws.region,
      endpoint: this.config.endpoint || aws.endpointUrl,
      credentials: this.config.credentials || aws.credentials,
    };
  }

  assertResource(resourceName) {
    if (!resourceName) {
      throw createHttpError(
        503,
        'LOCATION_NOT_CONFIGURED',
        'Location service is not configured',
      );
    }
  }

  getClient() {
    if (!this.client) {
      if (!this.clientOptions.region) {
        throw createHttpError(
          503,
          'LOCATION_NOT_CONFIGURED',
          'Location service is not configured',
        );
      }
      this.client = new LocationClient(this.clientOptions);
    }
    return this.client;
  }

  async send(command) {
    try {
      return await this.getClient().send(command);
    } catch (err) {
      throw providerError(err);
    }
  }

  async searchPlaces(text, bias = undefined) {
    this.assertResource(this.config.placeIndexName);
    const input = {
      IndexName: this.config.placeIndexName,
      Text: text,
    };
    if (bias) {
      input.BiasPosition = [bias.longitude, bias.latitude];
    }

    const response = await this.send(new SearchPlaceIndexForTextCommand(input));
    return { items: normalizePlaces(response?.Results) };
  }

  async reverseGeocode(latitude, longitude) {
    this.assertResource(this.config.placeIndexName);
    const response = await this.send(new SearchPlaceIndexForPositionCommand({
      IndexName: this.config.placeIndexName,
      Position: [longitude, latitude],
      MaxResults: 1,
    }));
    return { place: normalizePlaces(response?.Results)[0] ?? null };
  }

  async calculateRoute(origin, destination, mode = 'car') {
    this.assertResource(this.config.routeCalculatorName);
    const response = await this.send(new CalculateRouteCommand({
      CalculatorName: this.config.routeCalculatorName,
      DeparturePosition: [origin.longitude, origin.latitude],
      DestinationPosition: [destination.longitude, destination.latitude],
      TravelMode: TRAVEL_MODES[mode],
      DistanceUnit: 'Kilometers',
      IncludeLegGeometry: true,
    }));
    const legs = (Array.isArray(response?.Legs) ? response.Legs : []).map(normalizeLeg);

    return {
      route: {
        distanceMeters: kilometersToMeters(response?.Summary?.Distance),
        durationSeconds: Number.isFinite(response?.Summary?.DurationSeconds)
          ? response.Summary.DurationSeconds
          : 0,
        geometry: mergeLegGeometry(legs),
        legs,
      },
    };
  }
}

export const locationService = new LocationService();

export const searchPlaces = (...args) => locationService.searchPlaces(...args);
export const reverseGeocode = (...args) => locationService.reverseGeocode(...args);
export const calculateRoute = (...args) => locationService.calculateRoute(...args);
