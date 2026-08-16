import { adminRestaurantManagementService } from '../services/adminRestaurantManagementService.js';
import {
  deleteRestaurantImage,
  replaceRestaurantImage,
  updateRestaurantImage,
  uploadRestaurantImage,
} from '../services/restaurantImageService.js';
import { createHttpError } from '../utils/httpErrors.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const requireUuid = (value, field) => {
  if (!UUID_PATTERN.test(value || '')) {
    throw createHttpError(400, 'VALIDATION_ERROR', `${field} must be a valid UUID`);
  }
};

export const listAdminRestaurants = async (req, res, next) => {
  try {
    const result = await adminRestaurantManagementService.listRestaurants(req.user, req.query);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const getAdminRestaurant = async (req, res, next) => {
  try {
    requireUuid(req.params.restaurantId, 'restaurantId');
    const result = await adminRestaurantManagementService.getRestaurant(
      req.user,
      req.params.restaurantId,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const updateAdminRestaurant = async (req, res, next) => {
  try {
    requireUuid(req.params.restaurantId, 'restaurantId');
    const result = await adminRestaurantManagementService.updateRestaurant(
      req.user,
      req.params.restaurantId,
      req.body,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const listAdminRestaurantMenu = async (req, res, next) => {
  try {
    requireUuid(req.params.restaurantId, 'restaurantId');
    const result = await adminRestaurantManagementService.listMenuItems(
      req.user,
      req.params.restaurantId,
      req.query,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const createAdminRestaurantMenuItem = async (req, res, next) => {
  try {
    requireUuid(req.params.restaurantId, 'restaurantId');
    const result = await adminRestaurantManagementService.createMenuItem(
      req.user,
      req.params.restaurantId,
      req.body,
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

export const updateAdminRestaurantMenuItem = async (req, res, next) => {
  try {
    requireUuid(req.params.restaurantId, 'restaurantId');
    requireUuid(req.params.menuItemId, 'menuItemId');
    const result = await adminRestaurantManagementService.updateMenuItem(
      req.user,
      req.params.restaurantId,
      req.params.menuItemId,
      req.body,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const deleteAdminRestaurants = async (req, res, next) => {
  try {
    const result = await adminRestaurantManagementService.deleteRestaurants(
      req.user,
      req.body,
      req.header('idempotency-key'),
    );
    if (result.replayed) res.set('Idempotency-Replayed', 'true');
    res.status(result.statusCode).json(result.body);
  } catch (err) {
    next(err);
  }
};

export const uploadAdminRestaurantImage = async (req, res, next) => {
  try {
    requireUuid(req.params.restaurantId, 'restaurantId');
    const result = await uploadRestaurantImage({
      userId: req.user.id,
      roles: req.user.roles,
      restaurantId: req.params.restaurantId,
      idempotencyKey: req.header('idempotency-key'),
      fields: req.body,
      file: req.file,
    });
    if (result.replayed) res.set('Idempotency-Replayed', 'true');
    res.status(result.statusCode).json(result.body);
  } catch (err) {
    next(err);
  }
};

export const updateAdminRestaurantImage = async (req, res, next) => {
  try {
    requireUuid(req.params.restaurantId, 'restaurantId');
    requireUuid(req.params.imageId, 'imageId');
    const result = await updateRestaurantImage({
      userId: req.user.id,
      roles: req.user.roles,
      restaurantId: req.params.restaurantId,
      imageId: req.params.imageId,
      fields: req.body,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const replaceAdminRestaurantImage = async (req, res, next) => {
  try {
    requireUuid(req.params.restaurantId, 'restaurantId');
    requireUuid(req.params.imageId, 'imageId');
    const result = await replaceRestaurantImage({
      userId: req.user.id,
      roles: req.user.roles,
      restaurantId: req.params.restaurantId,
      imageId: req.params.imageId,
      idempotencyKey: req.header('idempotency-key'),
      fields: req.body,
      file: req.file,
    });
    if (result.replayed) res.set('Idempotency-Replayed', 'true');
    res.status(result.statusCode).json(result.body);
  } catch (err) {
    next(err);
  }
};

export const deleteAdminRestaurantImage = async (req, res, next) => {
  try {
    requireUuid(req.params.restaurantId, 'restaurantId');
    requireUuid(req.params.imageId, 'imageId');
    const result = await deleteRestaurantImage({
      userId: req.user.id,
      roles: req.user.roles,
      restaurantId: req.params.restaurantId,
      imageId: req.params.imageId,
      idempotencyKey: req.header('idempotency-key'),
    });
    if (result.replayed) res.set('Idempotency-Replayed', 'true');
    res.status(result.statusCode).json(result.body);
  } catch (err) {
    next(err);
  }
};
