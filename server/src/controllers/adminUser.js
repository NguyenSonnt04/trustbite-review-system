import { userService } from '../services/userService.js';
import { sendSuccess } from '../utils/responses.js';

export const suspendUser = async (req, res, next) => {
  try {
    const result = await userService.suspendUser(req.user, req.params.userId, req.body?.reason);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const reactivateUser = async (req, res, next) => {
  try {
    const result = await userService.reactivateUser(req.user, req.params.userId, req.body?.reason);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};
