import {
  createReviewForVerificationIntent,
  getReviewVerificationStatus,
  skipReviewReceiptVerification,
} from '../services/reviewService.js';
import {
  deleteReviewReaction,
  setReviewReaction,
} from '../services/reviewReactionService.js';
import {
  blockReviewAuthor,
  unblockReviewAuthor,
} from '../services/userBlockService.js';
import { createHttpError } from '../utils/httpErrors.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REACTION_TYPES = new Set(['LOVE', 'HAHA', 'ANGRY']);

export function parseReviewIdParam(reviewId) {
  if (typeof reviewId !== 'string' || !UUID_REGEX.test(reviewId)) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'reviewId must be a valid UUID');
  }
  return reviewId;
}

export function parseReviewReactionRequest(body) {
  const reactionType = body?.reactionType;
  if (typeof reactionType !== 'string' || !REACTION_TYPES.has(reactionType)) {
    throw createHttpError(
      422,
      'VALIDATION_ERROR',
      'reactionType must be one of LOVE, HAHA, ANGRY',
    );
  }
  return { reactionType };
}

export async function createReviewHandler(req, res, next) {
  try {
    const result = await createReviewForVerificationIntent({
      userId: req.user.id,
      payload: req.body,
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getReviewStatusHandler(req, res, next) {
  try {
    const result = await getReviewVerificationStatus({
      userId: req.user.id,
      reviewId: parseReviewIdParam(req.params.reviewId),
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function skipReviewVerificationHandler(req, res, next) {
  try {
    const result = await skipReviewReceiptVerification({
      userId: req.user.id,
      reviewId: parseReviewIdParam(req.params.reviewId),
      reason: req.body?.reason,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function setReviewReactionHandler(req, res, next) {
  try {
    const { reactionType } = parseReviewReactionRequest(req.body);
    const result = await setReviewReaction({
      userId: req.user.id,
      reviewId: parseReviewIdParam(req.params.reviewId),
      reactionType,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function deleteReviewReactionHandler(req, res, next) {
  try {
    const result = await deleteReviewReaction({
      userId: req.user.id,
      reviewId: parseReviewIdParam(req.params.reviewId),
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function blockReviewAuthorHandler(req, res, next) {
  try {
    const result = await blockReviewAuthor(
      req.user.id,
      parseReviewIdParam(req.params.reviewId),
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function unblockReviewAuthorHandler(req, res, next) {
  try {
    const result = await unblockReviewAuthor(
      req.user.id,
      parseReviewIdParam(req.params.reviewId),
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
