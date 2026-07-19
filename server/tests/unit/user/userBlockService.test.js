import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/config/db.js', () => ({
  pool: {
    connect: vi.fn(),
    query: vi.fn(),
  },
}));

const { pool } = await import('../../../src/config/db.js');
const {
  blockReviewAuthor,
  blockUser,
  unblockReviewAuthor,
  unblockUser,
} = await import('../../../src/services/userBlockService.js');

const BLOCKER_ID = '11111111-1111-4111-8111-111111111111';
const TARGET_ID = '22222222-2222-4222-8222-222222222222';
const BLOCK_ID = '33333333-3333-4333-8333-333333333333';
const REVIEW_ID = '44444444-4444-4444-8444-444444444444';

function createClient() {
  return {
    query: vi.fn(),
    release: vi.fn(),
  };
}

describe('blockUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts a new block and returns blockedUserId + blockedAt', async () => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    const createdAt = new Date('2026-06-07T12:30:00+07:00');
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: TARGET_ID }], rowCount: 1 }) // target exists
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // no existing block row
      .mockResolvedValueOnce({ rows: [{ blocked_user_id: TARGET_ID, created_at: createdAt }], rowCount: 1 }) // INSERT
      .mockResolvedValueOnce({}); // COMMIT

    const result = await blockUser(BLOCKER_ID, TARGET_ID, { reasonCode: 'ABUSIVE_LANGUAGE', sourceReviewId: REVIEW_ID });

    expect(result).toEqual({ blockedUserId: TARGET_ID, blockedAt: createdAt });
    expect(client.query.mock.calls[3][0]).toContain('INSERT INTO user_blocks');
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  it('reactivates a previously soft-deleted block instead of inserting a duplicate', async () => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    const createdAt = new Date('2026-06-08T09:00:00+07:00');
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: TARGET_ID }], rowCount: 1 }) // target exists
      .mockResolvedValueOnce({ rows: [{ id: BLOCK_ID, deleted_at: new Date('2026-06-07T00:00:00Z') }], rowCount: 1 }) // soft-deleted row
      .mockResolvedValueOnce({ rows: [{ blocked_user_id: TARGET_ID, created_at: createdAt }], rowCount: 1 }) // UPDATE
      .mockResolvedValueOnce({}); // COMMIT

    const result = await blockUser(BLOCKER_ID, TARGET_ID, {});

    expect(result).toEqual({ blockedUserId: TARGET_ID, blockedAt: createdAt });
    expect(client.query.mock.calls[3][0]).toContain('UPDATE user_blocks');
    expect(client.query.mock.calls[3][0]).toContain('deleted_at = NULL');
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
  });

  it('rejects self-block before opening a transaction', async () => {
    await expect(blockUser(BLOCKER_ID, BLOCKER_ID, {}))
      .rejects.toMatchObject({ statusCode: 400, code: 'CANNOT_BLOCK_SELF' });
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('returns 404 and rolls back when the target user does not exist', async () => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // target missing
      .mockResolvedValueOnce({}); // ROLLBACK

    await expect(blockUser(BLOCKER_ID, TARGET_ID, {}))
      .rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
  });

  it('returns 409 and rolls back when an active block already exists', async () => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: TARGET_ID }], rowCount: 1 }) // target exists
      .mockResolvedValueOnce({ rows: [{ id: BLOCK_ID, deleted_at: null }], rowCount: 1 }) // active block
      .mockResolvedValueOnce({}); // ROLLBACK

    await expect(blockUser(BLOCKER_ID, TARGET_ID, {}))
      .rejects.toMatchObject({ statusCode: 409, code: 'USER_ALREADY_BLOCKED' });
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
  });

  it('maps a unique-violation race to 409 USER_ALREADY_BLOCKED', async () => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    const uniqueErr = Object.assign(new Error('duplicate key'), { code: '23505' });
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: TARGET_ID }], rowCount: 1 }) // target exists
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // no existing row
      .mockRejectedValueOnce(uniqueErr) // INSERT races
      .mockResolvedValueOnce({}); // ROLLBACK

    await expect(blockUser(BLOCKER_ID, TARGET_ID, {}))
      .rejects.toMatchObject({ statusCode: 409, code: 'USER_ALREADY_BLOCKED' });
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
  });
});

describe('unblockUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('soft-deletes the active block and returns success', async () => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: BLOCK_ID }], rowCount: 1 }) // UPDATE active row
      .mockResolvedValueOnce({}); // COMMIT

    const result = await unblockUser(BLOCKER_ID, TARGET_ID);

    expect(result).toEqual({ success: true });
    expect(client.query.mock.calls[1][0]).toContain('UPDATE user_blocks');
    expect(client.query.mock.calls[1][0]).toContain('deleted_at = now()');
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
  });

  it('returns 404 and rolls back when there is no active block', async () => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // nothing updated
      .mockResolvedValueOnce({}); // ROLLBACK

    await expect(unblockUser(BLOCKER_ID, TARGET_ID))
      .rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
  });

  it('maps a unique-violation race on unblock cleanup to a mapped error, not a bare 500', async () => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    const dbErr = Object.assign(new Error('deadlock'), { code: '23505' });
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockRejectedValueOnce(dbErr) // UPDATE fails
      .mockResolvedValueOnce({}); // ROLLBACK

    await expect(unblockUser(BLOCKER_ID, TARGET_ID))
      .rejects.toMatchObject({ statusCode: 409, code: 'USER_ALREADY_BLOCKED' });
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
  });

  it('does not mask the original error when ROLLBACK also fails', async () => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    const originalErr = Object.assign(new Error('connection terminated'), { code: '08006' });
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockRejectedValueOnce(originalErr) // UPDATE fails (connection dropped)
      .mockRejectedValueOnce(new Error('rollback failed: no connection')); // ROLLBACK also fails

    await expect(unblockUser(BLOCKER_ID, TARGET_ID)).rejects.toBe(originalErr);
    expect(client.release).toHaveBeenCalled();
  });
});

describe('review-author block helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves only a public review author and delegates to the existing block rules', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ user_id: TARGET_ID }],
    });
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    const createdAt = new Date('2026-07-19T10:00:00.000Z');
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: TARGET_ID }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [{ blocked_user_id: TARGET_ID, created_at: createdAt }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({});

    await expect(blockReviewAuthor(BLOCKER_ID, REVIEW_ID)).resolves.toEqual({
      success: true,
      blockedAt: createdAt,
    });

    const [lookupSql, lookupParams] = pool.query.mock.calls[0];
    expect(lookupSql).toContain("status IN ('VERIFIED', 'REFERENCE_ONLY')");
    expect(lookupSql).toContain("public_visibility = 'PUBLIC'");
    expect(lookupSql).toContain('restaurant.is_deleted = FALSE');
    expect(lookupParams).toEqual([REVIEW_ID]);
    expect(client.query.mock.calls[3][1]).toEqual([
      BLOCKER_ID,
      TARGET_ID,
      null,
      REVIEW_ID,
    ]);
  });

  it('returns 404 for a private or nonexistent review without attempting a block', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    await expect(blockReviewAuthor(BLOCKER_ID, REVIEW_ID))
      .rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });

    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('uses the existing self-block rule when the authenticated user authored the review', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ user_id: BLOCKER_ID }],
    });

    await expect(blockReviewAuthor(BLOCKER_ID, REVIEW_ID))
      .rejects.toMatchObject({ statusCode: 400, code: 'CANNOT_BLOCK_SELF' });

    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('unblocks by source review even when the review is no longer public', async () => {
    const client = createClient();
    pool.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: BLOCK_ID }], rowCount: 1 })
      .mockResolvedValueOnce({});

    await expect(unblockReviewAuthor(BLOCKER_ID, REVIEW_ID))
      .resolves.toEqual({ success: true });

    expect(pool.query).not.toHaveBeenCalled();
    expect(client.query.mock.calls[1][0]).toContain('source_review_id = $2');
    expect(client.query.mock.calls[1][1]).toEqual([BLOCKER_ID, REVIEW_ID]);
  });
});
