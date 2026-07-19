import * as locationService from '../services/locationService.js';
import { createHttpError } from '../utils/httpErrors.js';

const EXACT_DECIMAL_PATTERN = /^-?(?:\d+|\d*\.\d+)$/u;
const TRAVEL_MODES = new Set(['car', 'truck', 'walking']);

const validationError = (message) => createHttpError(422, 'VALIDATION_ERROR', message);

const parseCoordinate = (raw, name, min, max) => {
  if (typeof raw !== 'string' || !EXACT_DECIMAL_PATTERN.test(raw)) {
    throw validationError(`${name} must be a valid number`);
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw validationError(`${name} must be between ${min} and ${max}`);
  }
  return value;
};

const parseCoordinatePair = (query, {
  latitudeName,
  longitudeName,
  optional = false,
}) => {
  const latitudeRaw = query?.[latitudeName];
  const longitudeRaw = query?.[longitudeName];
  const hasLatitude = latitudeRaw !== undefined;
  const hasLongitude = longitudeRaw !== undefined;

  if (optional && !hasLatitude && !hasLongitude) return undefined;
  if (hasLatitude !== hasLongitude) {
    throw validationError(`${latitudeName} and ${longitudeName} must be supplied together`);
  }

  return {
    latitude: parseCoordinate(latitudeRaw, latitudeName, -90, 90),
    longitude: parseCoordinate(longitudeRaw, longitudeName, -180, 180),
  };
};

export const searchPlacesHandler = async (req, res, next) => {
  try {
    if (typeof req.query?.q !== 'string') {
      throw validationError('q must be a string containing 1 to 200 characters');
    }
    const text = req.query.q.trim();
    if (!text || text.length > 200) {
      throw validationError('q must contain 1 to 200 characters');
    }
    const bias = parseCoordinatePair(req.query, {
      latitudeName: 'lat',
      longitudeName: 'lng',
      optional: true,
    });

    return res.status(200).json(await locationService.searchPlaces(text, bias));
  } catch (err) {
    return next(err);
  }
};

export const reverseGeocodeHandler = async (req, res, next) => {
  try {
    const position = parseCoordinatePair(req.query, {
      latitudeName: 'lat',
      longitudeName: 'lng',
    });
    return res.status(200).json(await locationService.reverseGeocode(
      position.latitude,
      position.longitude,
    ));
  } catch (err) {
    return next(err);
  }
};

export const calculateRouteHandler = async (req, res, next) => {
  try {
    const origin = parseCoordinatePair(req.query, {
      latitudeName: 'originLat',
      longitudeName: 'originLng',
    });
    const destination = parseCoordinatePair(req.query, {
      latitudeName: 'destLat',
      longitudeName: 'destLng',
    });
    const mode = req.query?.mode ?? 'car';
    if (typeof mode !== 'string' || !TRAVEL_MODES.has(mode)) {
      throw validationError('mode must be car, truck, or walking');
    }

    return res.status(200).json(await locationService.calculateRoute(
      origin,
      destination,
      mode,
    ));
  } catch (err) {
    return next(err);
  }
};
