import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/services/reviewService.js', () => ({
  createReviewForVerificationIntent: vi.fn(),
  getReviewVerificationStatus: vi.fn(),
  skipReviewReceiptVerification: vi.fn(),
}));

vi.mock('../../../src/services/reviewReactionService.js', () => ({
  deleteReviewReaction: vi.fn(),
  setReviewReaction: vi.fn(),
}));

vi.mock('../../../src/services/userBlockService.js', () => ({
  blockReviewAuthor: vi.fn(),
  unblockReviewAuthor: vi.fn(),
}));

const reviewService = await import('../../../src/services/reviewService.js');
const reactionService = await import('../../../src/services/reviewReactionService.js');
const userBlockService = await import('../../../src/services/userBlockService.js');
const {
  blockReviewAuthorHandler,
  deleteReviewReactionHandler,
  getReviewStatusHandler,
  parseReviewIdParam,
  parseReviewReactionRequest,
  setReviewReactionHandler,
  skipReviewVerificationHandler,
  unblockReviewAuthorHandler,
} = await import('../../../src/controllers/review.js');

function mockReq(reviewId) {
  return {
    params: { reviewId },
    body: {},
    user: { id: '11111111-1111-4111-8111-111111111111' },
  };
}

function mockRes() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe('review controller boundary validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses a valid review UUID', () => {
    expect(
      parseReviewIdParam('22222222-2222-4222-8222-222222222222'),
    ).toBe('22222222-2222-4222-8222-222222222222');
  });

  it.each([
    ['status', getReviewStatusHandler, reviewService.getReviewVerificationStatus],
    ['skip verification', skipReviewVerificationHandler, reviewService.skipReviewReceiptVerification],
  ])('rejects an invalid reviewId before %s service execution', async (
    _label,
    handler,
    service,
  ) => {
    const res = mockRes();
    const next = vi.fn();

    await handler(mockReq('not-a-uuid'), res, next);

    expect(service).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 422,
        code: 'VALIDATION_ERROR',
      }),
    );
  });

  it('parses exactly the supported reaction values', () => {
    expect(parseReviewReactionRequest({ reactionType: 'LOVE' })).toEqual({
      reactionType: 'LOVE',
    });
    expect(() => parseReviewReactionRequest({ reactionType: 'LIKE' }))
      .toThrowError(expect.objectContaining({
        statusCode: 422,
        code: 'VALIDATION_ERROR',
      }));
  });

  it('uses only the authenticated user id when setting a reaction', async () => {
    reactionService.setReviewReaction.mockResolvedValue({
      reviewId: '22222222-2222-4222-8222-222222222222',
      myReaction: 'HAHA',
      reactionCounts: { LOVE: 0, HAHA: 1, ANGRY: 0 },
    });
    const req = mockReq('22222222-2222-4222-8222-222222222222');
    req.body = {
      reactionType: 'HAHA',
      userId: '33333333-3333-4333-8333-333333333333',
    };
    const res = mockRes();

    await setReviewReactionHandler(req, res, vi.fn());

    expect(reactionService.setReviewReaction).toHaveBeenCalledWith({
      userId: req.user.id,
      reviewId: req.params.reviewId,
      reactionType: 'HAHA',
    });
  });

  it('removes only the authenticated user reaction', async () => {
    reactionService.deleteReviewReaction.mockResolvedValue({
      reviewId: '22222222-2222-4222-8222-222222222222',
      myReaction: null,
      reactionCounts: { LOVE: 0, HAHA: 0, ANGRY: 0 },
    });
    const req = mockReq('22222222-2222-4222-8222-222222222222');
    const res = mockRes();

    await deleteReviewReactionHandler(req, res, vi.fn());

    expect(reactionService.deleteReviewReaction).toHaveBeenCalledWith({
      userId: req.user.id,
      reviewId: req.params.reviewId,
    });
  });

  it.each([
    ['block', blockReviewAuthorHandler, userBlockService.blockReviewAuthor],
    ['unblock', unblockReviewAuthorHandler, userBlockService.unblockReviewAuthor],
  ])('rejects an invalid reviewId before %s-author service execution', async (
    _label,
    handler,
    service,
  ) => {
    const res = mockRes();
    const next = vi.fn();

    await handler(mockReq('not-a-uuid'), res, next);

    expect(service).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 422,
      code: 'VALIDATION_ERROR',
    }));
  });

  it('blocks a public review author without returning the reviewer user id', async () => {
    const blockedAt = new Date('2026-07-19T10:00:00.000Z');
    userBlockService.blockReviewAuthor.mockResolvedValue({
      success: true,
      blockedAt,
    });
    const req = mockReq('22222222-2222-4222-8222-222222222222');
    const res = mockRes();

    await blockReviewAuthorHandler(req, res, vi.fn());

    expect(userBlockService.blockReviewAuthor).toHaveBeenCalledWith(
      req.user.id,
      req.params.reviewId,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, blockedAt });
    expect(res.json.mock.calls[0][0]).not.toHaveProperty('blockedUserId');
  });

  it('unblocks a public review author without returning the reviewer user id', async () => {
    userBlockService.unblockReviewAuthor.mockResolvedValue({ success: true });
    const req = mockReq('22222222-2222-4222-8222-222222222222');
    const res = mockRes();

    await unblockReviewAuthorHandler(req, res, vi.fn());

    expect(userBlockService.unblockReviewAuthor).toHaveBeenCalledWith(
      req.user.id,
      req.params.reviewId,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });
});
