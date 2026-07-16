import { userService } from '../services/userService.js';
import { createHttpError } from '../utils/httpErrors.js';
import { sendSuccess } from '../utils/responses.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ADMIN_REASON_MAX_LENGTH = 500;

const getValidatedUserIdParam = (req) => {
  const { userId } = req.params;
  if (!UUID_REGEX.test(userId)) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'userId must be a valid UUID');
  }
  return userId;
};

const getValidatedAdminReason = (body = {}) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'Request body must be an object');
  }
  if (Object.keys(body).some((field) => field !== 'reason')) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'Request body contains unsupported fields');
  }
  const { reason } = body;

  if (typeof reason !== 'string') {
    throw createHttpError(422, 'VALIDATION_ERROR', 'reason must be a string');
  }

  const normalized = reason.trim();
  if (normalized.length === 0) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'reason must not be empty');
  }

  if (normalized.length > ADMIN_REASON_MAX_LENGTH) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'reason must be at most 500 characters');
  }

  return normalized;
};

export const getAdminSession = async (req, res, next) => {
  try {
    sendSuccess(res, {
      user: {
        id: req.user.id,
        displayName: req.user.displayName,
        status: req.user.status,
        roles: req.user.roles,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const suspendUser = async (req, res, next) => {
  try {
    const result = await userService.suspendUser(req.user, getValidatedUserIdParam(req), getValidatedAdminReason(req.body));
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const reactivateUser = async (req, res, next) => {
  try {
    const result = await userService.reactivateUser(req.user, getValidatedUserIdParam(req), getValidatedAdminReason(req.body));
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};
