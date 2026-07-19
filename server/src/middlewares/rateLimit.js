import { createHttpError } from '../utils/httpErrors.js';

const OVERFLOW_BUCKET = '__overflow__';

export function createFixedWindowRateLimiter({
  maxRequests,
  windowMs,
  code,
  message,
  maxBuckets = 10_000,
  now = Date.now,
}) {
  if (!Number.isInteger(maxRequests) || maxRequests <= 0) {
    throw new TypeError('maxRequests must be a positive integer');
  }
  if (!Number.isInteger(windowMs) || windowMs <= 0) {
    throw new TypeError('windowMs must be a positive integer');
  }

  const buckets = new Map();
  let nextSweepAt = 0;

  return (req, res, next) => {
    const currentTime = now();
    if (currentTime >= nextSweepAt) {
      for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= currentTime) buckets.delete(key);
      }
      nextSweepAt = currentTime + windowMs;
    }

    const clientAddress = req.ip || req.socket?.remoteAddress || 'unknown';
    const key = buckets.has(clientAddress) || buckets.size < maxBuckets
      ? clientAddress
      : OVERFLOW_BUCKET;
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= currentTime) {
      bucket = { count: 0, resetAt: currentTime + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((bucket.resetAt - currentTime) / 1000),
    );
    res.set('RateLimit-Limit', String(maxRequests));
    res.set('RateLimit-Remaining', String(Math.max(0, maxRequests - bucket.count)));
    res.set('RateLimit-Reset', String(retryAfterSeconds));

    if (bucket.count > maxRequests) {
      res.set('Retry-After', String(retryAfterSeconds));
      next(createHttpError(429, code, message));
      return;
    }

    next();
  };
}
