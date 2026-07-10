import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/config/db.js', () => ({
  pool: {
    connect: vi.fn(),
    query: vi.fn(),
  },
}));

const { pool } = await import('../../../src/config/db.js');
const { createReport } = await import('../../../src/services/moderationService.js');

const REPORTER_ID = '11111111-1111-4111-8111-111111111111';
const ENTITY_ID = '22222222-2222-4222-8222-222222222222';
const REPORT_ID = '33333333-3333-4333-8333-333333333333';
const AUTHOR_ID = '44444444-4444-4444-8444-444444444444';

function createClient() {
  return {
    query: vi.fn(),
    release: vi.fn(),
  };
}

const reviewReport = (overrides = {}) => ({
  entityType: 'REVIEW',
  entityId: ENTITY_ID,
  reasonCode: 'SPAM_OR_FAKE',
  description: null,
  ...overrides,
});

describe('createReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts a submitted report and returns reportId + status', async () => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ entity_type: 'REVIEW' }], rowCount: 1 }) // reason code
      .mockResolvedValueOnce({ rows: [{ id: ENTITY_ID, owner_id: AUTHOR_ID }], rowCount: 1 }) // entity exists, other author
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // no open duplicate
      .mockResolvedValueOnce({ rows: [{ id: REPORT_ID, status: 'SUBMITTED' }], rowCount: 1 }) // INSERT
      .mockResolvedValueOnce({}); // COMMIT

    const result = await createReport(REPORTER_ID, reviewReport());

    expect(result).toEqual({ reportId: REPORT_ID, status: 'SUBMITTED' });
    expect(client.query.mock.calls[4][0]).toContain('INSERT INTO moderation_reports');
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  it('rejects reporting your own account before opening a transaction', async () => {
    await expect(createReport(REPORTER_ID, reviewReport({ entityType: 'USER', entityId: REPORTER_ID })))
      .rejects.toMatchObject({ statusCode: 422, code: 'VALIDATION_ERROR' });
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('rejects an unknown reason code and rolls back', async () => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // reason not found
      .mockResolvedValueOnce({}); // ROLLBACK

    await expect(createReport(REPORTER_ID, reviewReport({ reasonCode: 'UNKNOWN' })))
      .rejects.toMatchObject({ statusCode: 422, code: 'VALIDATION_ERROR' });
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
  });

  it('rejects a reason code whose entity_type does not match and rolls back', async () => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ entity_type: 'USER' }], rowCount: 1 }) // mismatch
      .mockResolvedValueOnce({}); // ROLLBACK

    await expect(createReport(REPORTER_ID, reviewReport()))
      .rejects.toMatchObject({ statusCode: 422, code: 'VALIDATION_ERROR' });
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
  });

  it('rejects reporting your own review and rolls back', async () => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ entity_type: 'REVIEW' }], rowCount: 1 }) // reason ok
      .mockResolvedValueOnce({ rows: [{ id: ENTITY_ID, owner_id: REPORTER_ID }], rowCount: 1 }) // own review
      .mockResolvedValueOnce({}); // ROLLBACK

    await expect(createReport(REPORTER_ID, reviewReport()))
      .rejects.toMatchObject({ statusCode: 422, code: 'VALIDATION_ERROR' });
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
  });

  it('rejects a report against a non-existent entity and rolls back', async () => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ entity_type: 'REVIEW' }], rowCount: 1 }) // reason ok
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // entity missing
      .mockResolvedValueOnce({}); // ROLLBACK

    await expect(createReport(REPORTER_ID, reviewReport()))
      .rejects.toMatchObject({ statusCode: 422, code: 'VALIDATION_ERROR' });
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
  });

  it('rejects a duplicate open report with 409 and rolls back', async () => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ entity_type: 'REVIEW' }], rowCount: 1 }) // reason ok
      .mockResolvedValueOnce({ rows: [{ id: ENTITY_ID }], rowCount: 1 }) // entity exists
      .mockResolvedValueOnce({ rows: [{ id: REPORT_ID }], rowCount: 1 }) // open duplicate found
      .mockResolvedValueOnce({}); // ROLLBACK

    await expect(createReport(REPORTER_ID, reviewReport()))
      .rejects.toMatchObject({ statusCode: 409, code: 'REPORT_DUPLICATE' });
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
  });

  it('maps a unique-violation race to 409 REPORT_DUPLICATE', async () => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    const uniqueErr = Object.assign(new Error('duplicate key'), { code: '23505' });
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ entity_type: 'REVIEW' }], rowCount: 1 }) // reason ok
      .mockResolvedValueOnce({ rows: [{ id: ENTITY_ID }], rowCount: 1 }) // entity exists
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // no open duplicate
      .mockRejectedValueOnce(uniqueErr) // INSERT races
      .mockResolvedValueOnce({}); // ROLLBACK

    await expect(createReport(REPORTER_ID, reviewReport()))
      .rejects.toMatchObject({ statusCode: 409, code: 'REPORT_DUPLICATE' });
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
  });

  it('does not mask the original error when ROLLBACK also fails', async () => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    const originalErr = Object.assign(new Error('connection terminated'), { code: '08006' });
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockRejectedValueOnce(originalErr) // reason lookup fails (connection dropped)
      .mockRejectedValueOnce(new Error('rollback failed: no connection')); // ROLLBACK also fails

    await expect(createReport(REPORTER_ID, reviewReport())).rejects.toBe(originalErr);
    expect(client.release).toHaveBeenCalled();
  });
});
