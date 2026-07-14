import crypto from 'node:crypto';
import appConfig from '../config/app.js';
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
