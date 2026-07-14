import { adminUserManagementService } from '../services/adminUserManagementService.js';
import { createHttpError } from '../utils/httpErrors.js';
import { sendSuccess } from '../utils/responses.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const getUserId = (req) => {
  const userId = req.params.userId;
  if (!UUID_PATTERN.test(userId)) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'userId must be a valid UUID');
  }
  return userId;
};

export const listAdminUsers = async (req, res, next) => {
  try {
    sendSuccess(res, await adminUserManagementService.listUsers(req.user, req.query));
  } catch (err) {
    next(err);
  }
};

export const getAdminUser = async (req, res, next) => {
  try {
    sendSuccess(res, await adminUserManagementService.getUser(req.user, getUserId(req)));
  } catch (err) {
    next(err);
  }
};

export const createAdminUser = async (req, res, next) => {
  try {
    sendSuccess(res, await adminUserManagementService.createUser(req.user, req.body), 201);
  } catch (err) {
    next(err);
  }
};

export const updateAdminUser = async (req, res, next) => {
  try {
    sendSuccess(res, await adminUserManagementService.updateUser(req.user, getUserId(req), req.body));
  } catch (err) {
    next(err);
  }
};
