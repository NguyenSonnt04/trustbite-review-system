import { Router } from 'express';
import appConfig from '../config/app.js';
import {
  calculateRouteHandler,
  reverseGeocodeHandler,
  searchPlacesHandler,
} from '../controllers/location.js';
import { createFixedWindowRateLimiter } from '../middlewares/rateLimit.js';

const defaultRateLimiter = createFixedWindowRateLimiter({
  maxRequests: appConfig.location.rateLimitMax,
  windowMs: appConfig.location.rateLimitWindowMs,
  code: 'LOCATION_RATE_LIMITED',
  message: 'Too many location requests; try again later',
});

export function createLocationRouter({ rateLimiter = defaultRateLimiter } = {}) {
  const router = Router();
  router.use(rateLimiter);
  router.get('/search', searchPlacesHandler);
  router.get('/reverse-geocode', reverseGeocodeHandler);
  router.get('/route', calculateRouteHandler);
  return router;
}

export default createLocationRouter();
