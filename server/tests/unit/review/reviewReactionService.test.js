import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();
const release = vi.fn();

vi.mock('../../../src/config/db.js', () => ({
  pool: {
    connect: vi.fn(async () => ({ query, release })),
  },
}));

const {
  deleteReviewReaction,
  setReviewReaction,
} = await import('../../../src/services/reviewReactionService.js');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const REVIEW_ID = '22222222-2222-4222-8222-222222222222';

describe('reviewReactionService', () => {
  beforeEach(() => {
    query.mockReset();
    release.mockReset();
  });

  it('rejects unsupported reaction types before opening a transaction', async () => {
    await expect(
      setReviewReaction({
        userId: USER_ID,
        reviewId: REVIEW_ID,
        reactionType: 'LIKE',
      }),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: 'VALIDATION_ERROR',
    });
    expect(query).not.toHaveBeenCalled();
  });

  it('upserts exactly one reaction for the authenticated user and returns aggregates', async () => {
    query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: REVIEW_ID }] })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{ LOVE: 2, HAHA: 1, ANGRY: 0 }],
      })
      .mockResolvedValueOnce({});

    await expect(
      setReviewReaction({
        userId: USER_ID,
        reviewId: REVIEW_ID,
        reactionType: 'LOVE',
      }),
    ).resolves.toEqual({
      reviewId: REVIEW_ID,
      myReaction: 'LOVE',
      reactionCounts: { LOVE: 2, HAHA: 1, ANGRY: 0 },
    });

    expect(query.mock.calls[2][0]).toContain('ON CONFLICT (review_id, user_id)');
    expect(query.mock.calls[2][1]).toEqual([REVIEW_ID, USER_ID, 'LOVE']);
    expect(query.mock.calls.at(-1)[0]).toBe('COMMIT');
    expect(release).toHaveBeenCalledOnce();
  });

  it('deletes only the authenticated user reaction and remains idempotent', async () => {
    query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: REVIEW_ID }] })
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [{ LOVE: 0, HAHA: 0, ANGRY: 0 }],
      })
      .mockResolvedValueOnce({});

    await expect(
      deleteReviewReaction({ userId: USER_ID, reviewId: REVIEW_ID }),
    ).resolves.toEqual({
      reviewId: REVIEW_ID,
      myReaction: null,
      reactionCounts: { LOVE: 0, HAHA: 0, ANGRY: 0 },
    });

    expect(query.mock.calls[2]).toEqual([
      expect.stringContaining('DELETE FROM review_reactions'),
      [REVIEW_ID, USER_ID],
    ]);
  });

  it('rolls back when the review is not publicly reactable', async () => {
    query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({});

    await expect(
      setReviewReaction({
        userId: USER_ID,
        reviewId: REVIEW_ID,
        reactionType: 'ANGRY',
      }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });

    expect(query.mock.calls.at(-1)[0]).toBe('ROLLBACK');
    expect(release).toHaveBeenCalledOnce();
  });
});
