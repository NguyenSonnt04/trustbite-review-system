import crypto from 'node:crypto';
import appConfig from '../config/app.js';
import { adminWebAuthService } from '../services/adminWebAuth.js';
import { createHttpError } from '../utils/httpErrors.js';

const safeEqual = (left, right) => {
  const leftDigest = crypto.createHash('sha256').update(left).digest();
  const rightDigest = crypto.createHash('sha256').update(right).digest();
  return crypto.timingSafeEqual(leftDigest, rightDigest);
};

export const requireAdminBff = (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const configuredSecret = appConfig.auth.adminWeb.bffSecret;
  if (!configuredSecret) {
    next(createHttpError(503, 'AUTH_NOT_CONFIGURED', 'Admin authentication is not configured'));
    return;
  }

  const providedSecret = req.header('x-trustbite-bff-secret') || '';
  if (!providedSecret || !safeEqual(providedSecret, configuredSecret)) {
    next(createHttpError(401, 'BFF_AUTH_REQUIRED', 'BFF authentication is required'));
    return;
  }

  next();
};

export const requireAdminWebSession = async (req, res, next) => {
  try {
    const sessionToken = req.header('x-trustbite-admin-session') || '';
    const session = await adminWebAuthService.validate(sessionToken);
    req.user = session.user;
    req.adminSessionExpiresAt = session.expiresAt;
    next();
  } catch (err) {
    next(err);
  }
};
