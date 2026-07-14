import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('AdminWebSessionStore', () => {
  const validToken = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';
  let redis;
  let store;

  beforeEach(async () => {
    vi.resetModules();
    redis = {
      set: vi.fn().mockResolvedValue('OK'),
      get: vi.fn(),
      del: vi.fn().mockResolvedValue(1),
      eval: vi.fn().mockResolvedValue([1, 300]),
    };
    const { AdminWebSessionStore } = await import(
      '../../../src/services/adminWebSessionStore.js'
    );
    store = new AdminWebSessionStore({
      redis,
      maxLifetimeSeconds: 900,
      keySecret: 'test-session-key-secret',
    });
  });

  it('stores only a hash-addressed opaque marker bounded by provider expiry', async () => {
    const providerExpiry = new Date(Date.now() + 10 * 60 * 1000);
    const result = await store.create({
      userId: '11111111-1111-4111-8111-111111111111',
      cognitoSubject: 'cognito-admin-sub',
      expiresAt: providerExpiry,
    });

    expect(result.token).toMatch(/^[A-Za-z0-9_-]{40,}$/u);
    expect(result.expiresAt.getTime()).toBeLessThanOrEqual(providerExpiry.getTime());
    const [key, serialized, mode, ttl] = redis.set.mock.calls[0];
    expect(key).not.toContain(result.token);
    expect(key).toContain(crypto
      .createHmac('sha256', 'test-session-key-secret')
      .update(result.token)
      .digest('hex'));
    expect(serialized).not.toContain('accessToken');
    expect(serialized).not.toContain('refreshToken');
    expect(mode).toBe('EX');
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(900);
  });

  it('rejects malformed, expired, and subjectless stored sessions', async () => {
    for (const value of [
      'not-json',
      JSON.stringify({ version: 1, userId: 'user', cognitoSubject: '', expiresAt: Date.now() + 1000 }),
      JSON.stringify({ version: 1, userId: 'user', cognitoSubject: 'sub', expiresAt: Date.now() - 1000 }),
    ]) {
      redis.get.mockResolvedValueOnce(value);
      await expect(store.read(validToken)).rejects.toMatchObject({
        code: 'ADMIN_SESSION_INVALID',
      });
    }

    expect(redis.del).toHaveBeenCalledTimes(3);
  });

  it('rejects missing and malformed tokens before Redis lookup', async () => {
    await expect(store.read('')).rejects.toMatchObject({ code: 'ADMIN_SESSION_INVALID' });
    await expect(store.read('contains spaces')).rejects.toMatchObject({
      code: 'ADMIN_SESSION_INVALID',
    });
    expect(redis.get).not.toHaveBeenCalled();
  });

  it('fails closed when Redis is unavailable', async () => {
    redis.get.mockRejectedValue(new Error('redis unavailable'));

    await expect(store.read(validToken)).rejects.toMatchObject({
      statusCode: 503,
      code: 'SESSION_STORE_UNAVAILABLE',
    });
  });

  it.each([
    ['create', 'set', async () => store.create({
      userId: '11111111-1111-4111-8111-111111111111',
      cognitoSubject: 'cognito-admin-sub',
      expiresAt: new Date(Date.now() + 60_000),
    })],
    ['revoke', 'del', async () => store.revoke(validToken)],
    ['throttle', 'eval', async () => store.consumeLoginAttempt({
      email: 'admin@example.com',
      ipAddress: '127.0.0.1',
      maxAttempts: 5,
      windowSeconds: 300,
    })],
  ])('fails closed when Redis cannot %s', async (_name, method, operation) => {
    redis[method].mockRejectedValue(new Error('redis unavailable'));
    await expect(operation()).rejects.toMatchObject({
      statusCode: 503,
      code: 'SESSION_STORE_UNAVAILABLE',
    });
  });

  it('throttles login keys without storing raw email addresses', async () => {
    redis.eval.mockResolvedValue([6, 120]);

    await expect(store.consumeLoginAttempt({
      email: 'admin@example.com',
      ipAddress: '127.0.0.1',
      maxAttempts: 5,
      windowSeconds: 300,
    })).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 120,
    });

    const key = redis.eval.mock.calls[0][2];
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('EXPIRE'"),
      1,
      key,
      300,
    );
    expect(key).not.toContain('admin@example.com');
    expect(key).not.toContain('127.0.0.1');
  });

  it('enforces an email-wide limit even when the client address changes', async () => {
    redis.eval
      .mockResolvedValueOnce([1, 120])
      .mockResolvedValueOnce([21, 120]);

    await expect(store.consumeLoginAttempt({
      email: 'admin@example.com',
      ipAddress: '203.0.113.10',
      maxAttempts: 5,
      emailMaxAttempts: 20,
      windowSeconds: 300,
    })).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 120,
    });

    const emailKey = redis.eval.mock.calls[1][2];
    expect(emailKey).toContain(':email:');
    expect(emailKey).not.toContain('admin@example.com');
    expect(emailKey).not.toContain('203.0.113.10');
  });

  it('uses only the email-wide limit when no trusted client address is available', async () => {
    redis.eval.mockResolvedValue([1, 120]);

    await expect(store.consumeLoginAttempt({
      email: 'admin@example.com',
      ipAddress: '',
      maxAttempts: 5,
      emailMaxAttempts: 20,
      windowSeconds: 300,
    })).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });

    expect(redis.eval).toHaveBeenCalledTimes(1);
    expect(redis.eval.mock.calls[0][2]).toContain(':email:');
  });
});
