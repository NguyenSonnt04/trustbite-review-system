import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/config/db.js', () => ({
  pool: {
    connect: vi.fn(),
    query: vi.fn(),
  },
}));

const { pool } = await import('../../../src/config/db.js');
const {
  purgeExpiredOtpVerifications,
  anonymizeStaleReceiptSignals,
  purgeExpiredNotifications,
  runDataRetention,
} = await import('../../../src/services/dataRetentionService.js');

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-07-10T00:00:00.000Z');
const RULES = { otpRetentionDays: 30, receiptSignalRetentionDays: 90, notificationRetentionDays: 365 };

function createClient() {
  return {
    query: vi.fn(),
    release: vi.fn(),
  };
}

function expectedCutoff(days) {
  return new Date(NOW.getTime() - days * DAY_MS);
}

describe('purgeExpiredOtpVerifications', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes OTP rows older than the retention cutoff and commits', async () => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rowCount: 4 }) // DELETE
      .mockResolvedValueOnce({}); // COMMIT

    const deleted = await purgeExpiredOtpVerifications(NOW, RULES);

    expect(deleted).toBe(4);
    const [sql, params] = client.query.mock.calls[1];
    expect(sql).toContain('DELETE FROM otp_verifications');
    expect(params[0]).toEqual(expectedCutoff(30));
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  it('rolls back and rethrows when the delete fails', async () => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    const dbErr = new Error('db down');
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockRejectedValueOnce(dbErr) // DELETE fails
      .mockResolvedValueOnce({}); // ROLLBACK

    await expect(purgeExpiredOtpVerifications(NOW, RULES)).rejects.toBe(dbErr);
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });

  it('does not mask the original error when ROLLBACK also fails', async () => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    const originalErr = new Error('connection terminated');
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockRejectedValueOnce(originalErr) // DELETE fails
      .mockRejectedValueOnce(new Error('rollback failed')); // ROLLBACK fails

    await expect(purgeExpiredOtpVerifications(NOW, RULES)).rejects.toBe(originalErr);
    expect(client.release).toHaveBeenCalled();
  });
});

describe('anonymizeStaleReceiptSignals', () => {
  beforeEach(() => vi.clearAllMocks());

  it('nulls IP/GPS columns for receipts older than the cutoff', async () => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rowCount: 2 }) // UPDATE
      .mockResolvedValueOnce({}); // COMMIT

    const anonymized = await anonymizeStaleReceiptSignals(NOW, RULES);

    expect(anonymized).toBe(2);
    const [sql, params] = client.query.mock.calls[1];
    expect(sql).toContain('UPDATE receipt_verifications');
    expect(sql).toContain('request_ip = NULL');
    expect(sql).toContain('gps_latitude = NULL');
    expect(sql).not.toContain('gps_distance_meters');
    expect(params[0]).toEqual(expectedCutoff(90));
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
  });
});

describe('purgeExpiredNotifications', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes notifications older than the cutoff', async () => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rowCount: 7 }) // DELETE
      .mockResolvedValueOnce({}); // COMMIT

    const deleted = await purgeExpiredNotifications(NOW, RULES);

    expect(deleted).toBe(7);
    const [sql, params] = client.query.mock.calls[1];
    expect(sql).toContain('DELETE FROM notifications');
    expect(params[0]).toEqual(expectedCutoff(365));
  });
});

describe('runDataRetention', () => {
  beforeEach(() => vi.clearAllMocks());

  it('aggregates the affected-row counts from every action', async () => {
    const counts = [4, 2, 7];
    let call = 0;
    pool.connect.mockImplementation(async () => {
      const client = createClient();
      const rowCount = counts[call];
      call += 1;
      client.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rowCount }) // DELETE/UPDATE
        .mockResolvedValueOnce({}); // COMMIT
      return client;
    });

    const summary = await runDataRetention({ now: NOW, rules: RULES });

    expect(summary).toEqual({
      otpDeleted: 4,
      receiptSignalsAnonymized: 2,
      notificationsDeleted: 7,
      errors: null,
    });
    expect(pool.connect).toHaveBeenCalledTimes(3);
  });

  it('continues running later actions when an earlier action fails and reports the error', async () => {
    // Action order: OTP (fails), receipt anonymize (ok), notifications (ok).
    let call = 0;
    pool.connect.mockImplementation(async () => {
      const client = createClient();
      if (call === 0) {
        client.query
          .mockResolvedValueOnce({}) // BEGIN
          .mockRejectedValueOnce(new Error('otp table locked')) // DELETE fails
          .mockResolvedValueOnce({}); // ROLLBACK
      } else {
        const rowCount = call; // 1 then 2
        client.query
          .mockResolvedValueOnce({}) // BEGIN
          .mockResolvedValueOnce({ rowCount }) // work
          .mockResolvedValueOnce({}); // COMMIT
      }
      call += 1;
      return client;
    });

    const summary = await runDataRetention({ now: NOW, rules: RULES });

    expect(summary.otpDeleted).toBeNull();
    expect(summary.receiptSignalsAnonymized).toBe(1);
    expect(summary.notificationsDeleted).toBe(2);
    expect(summary.errors).toEqual({ otpDeleted: 'otp table locked' });
    expect(pool.connect).toHaveBeenCalledTimes(3);
  });
});
