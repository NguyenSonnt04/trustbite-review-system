import crypto from 'node:crypto';
import { createHttpError } from '../utils/httpErrors.js';

const safeEqual = (left, right) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length
    && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

export const requireAdminBff = (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const configuredSecret = process.env.ADMIN_WEB_BFF_SECRET || '';
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
