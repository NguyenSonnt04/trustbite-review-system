import { userService } from '../services/userService.js';
import { sendAccepted, sendSuccess } from '../utils/responses.js';

export const getMe = async (req, res, next) => {
  try {
    const user = await userService.getCurrentUser(req.user.id);
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
};

export const updateMe = async (req, res, next) => {
  try {
    const user = await userService.updateCurrentUser(req.user.id, req.body || {});
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
};

export const createDeletionRequest = async (req, res, next) => {
  try {
    const deletionRequest = await userService.createDeletionRequest(req.user.id, req.body || {});
    sendAccepted(res, deletionRequest);
  } catch (err) {
    next(err);
  }
};

export const getDeletionRequest = async (req, res, next) => {
  try {
    const deletionRequest = await userService.getOpenDeletionRequest(req.user.id);
    sendSuccess(res, deletionRequest);
  } catch (err) {
    next(err);
  }
};

export const cancelDeletionRequest = async (req, res, next) => {
  try {
    const deletionRequest = await userService.cancelDeletionRequest(req.user.id);
    sendSuccess(res, deletionRequest);
  } catch (err) {
    next(err);
  }
};
