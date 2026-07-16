import { describe, expect, it, vi } from 'vitest';

import { createFixedWindowRateLimiter } from '../../../src/middlewares/rateLimit.js';

describe('createFixedWindowRateLimiter', () => {
  it('rejects requests above the per-client quota before the handler runs', () => {
    const now = vi.fn(() => 1_000);
    const limiter = createFixedWindowRateLimiter({
      maxRequests: 2,
      windowMs: 60_000,
      now,
      code: 'LOCATION_RATE_LIMITED',
      message: 'Too many location requests; try again later',
    });
    const request = { ip: '203.0.113.10' };
    const response = { set: vi.fn() };
    const next = vi.fn();

    limiter(request, response, next);
    limiter(request, response, next);
    limiter(request, response, next);

    expect(next).toHaveBeenNthCalledWith(1);
    expect(next).toHaveBeenNthCalledWith(2);
    expect(next.mock.calls[2][0]).toMatchObject({
      statusCode: 429,
      code: 'LOCATION_RATE_LIMITED',
    });
    expect(response.set).toHaveBeenCalledWith('Retry-After', '60');
  });
});
