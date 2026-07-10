import { userService } from '../services/userService.js';
import { avatarUploadService } from '../services/avatarStorageService.js';
import { getUserGamification } from '../services/gamificationService.js';
import { blockUser, unblockUser } from '../services/userBlockService.js';
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

export const getMyGamification = async (req, res, next) => {
  try {
    const gamification = await getUserGamification(req.user.id);
    sendSuccess(res, gamification);
  } catch (err) {
    next(err);
  }
};

export const createAvatarUploadUrl = async (req, res, next) => {
  try {
    const upload = await avatarUploadService.createUploadUrl({
      userId: req.user.id,
      contentType: req.body?.contentType,
      fileSizeBytes: req.body?.fileSizeBytes,
    });
    sendSuccess(res, upload);
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

export const blockUserById = async (req, res, next) => {
  try {
    const result = await blockUser(req.user.id, req.params.userId, req.body || {});
    sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
};

export const unblockUserById = async (req, res, next) => {
  try {
    const result = await unblockUser(req.user.id, req.params.userId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};
