import {
  listFavoriteRestaurants,
  removeFavoriteRestaurant,
  saveFavoriteRestaurant,
} from '../services/favoriteService.js';
import { createHttpError } from '../utils/httpErrors.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseRestaurantIdParam(restaurantId) {
  if (typeof restaurantId !== 'string' || !UUID_REGEX.test(restaurantId)) {
    throw createHttpError(
      422,
      'VALIDATION_ERROR',
      'restaurantId must be a valid UUID',
    );
  }
  return restaurantId;
}

export async function listFavoritesHandler(req, res, next) {
  try {
    const result = await listFavoriteRestaurants(req.user.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function saveFavoriteHandler(req, res, next) {
  try {
    const result = await saveFavoriteRestaurant(
      req.user.id,
      parseRestaurantIdParam(req.params.restaurantId),
    );
    res.status(result.created ? 201 : 200).json({ saved: true });
  } catch (error) {
    next(error);
  }
}

export async function removeFavoriteHandler(req, res, next) {
  try {
    const result = await removeFavoriteRestaurant(
      req.user.id,
      parseRestaurantIdParam(req.params.restaurantId),
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
