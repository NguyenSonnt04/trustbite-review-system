import { userService } from '../services/userService.js';
import { avatarUploadService } from '../services/avatarStorageService.js';
import { getUserGamification } from '../services/gamificationService.js';
import { sendAccepted, sendSuccess } from '../utils/responses.js';

const withDisplayAvatar = async (user) => {
  if (!user.avatarUrl) return user;
  const displayAvatarUrl = await avatarUploadService.resolveReadUrl(user.avatarUrl);
  return {
    ...user,
    avatarUrl: displayAvatarUrl ?? user.avatarUrl,
  };
};

export const getMe = async (req, res, next) => {
  try {
    const user = await userService.getCurrentUser(req.user.id);
    sendSuccess(res, {
      ...await withDisplayAvatar(user),
      roles: req.user.roles,
    });
  } catch (err) {
    next(err);
  }
};

export const updateMe = async (req, res, next) => {
  try {
    const user = await userService.updateCurrentUser(req.user.id, req.body || {});
    sendSuccess(res, await withDisplayAvatar(user));
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
