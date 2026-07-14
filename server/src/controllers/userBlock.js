import { blockUser, unblockUser } from '../services/userBlockService.js';
import { createHttpError } from '../utils/httpErrors.js';
import { sendSuccess } from '../utils/responses.js';

/**
 * userBlock controller — HTTP boundary for user-to-user block/unblock.
 *
 * Per the project architecture rule, unknown input (path params + body) is parsed
 * and validated here at the boundary before the service/domain logic runs. The
 * service receives only well-formed, normalized values.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REASON_CODE_MAX_LENGTH = 60;

export function parseTargetUserId(userId) {
  if (typeof userId !== 'string' || !UUID_REGEX.test(userId)) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'userId must be a valid UUID');
  }
  return userId;
}

function parseReasonCode(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw createHttpError(422, 'VALIDATION_ERROR', 'reasonCode must be a string');
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > REASON_CODE_MAX_LENGTH) {
    throw createHttpError(422, 'VALIDATION_ERROR', `reasonCode must be at most ${REASON_CODE_MAX_LENGTH} characters`);
  }
  return trimmed;
}

function parseSourceReviewId(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !UUID_REGEX.test(value)) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'sourceReviewId must be a valid UUID');
  }
  return value;
}

export function parseBlockRequest({ userId, body } = {}) {
  const targetUserId = parseTargetUserId(userId);

  if (body !== undefined && body !== null && typeof body !== 'object') {
    throw createHttpError(422, 'VALIDATION_ERROR', 'Request body must be an object');
  }

  const safeBody = body || {};
  return {
    targetUserId,
    reasonCode: parseReasonCode(safeBody.reasonCode),
    sourceReviewId: parseSourceReviewId(safeBody.sourceReviewId),
  };
}

export const blockUserById = async (req, res, next) => {
  try {
    const { targetUserId, reasonCode, sourceReviewId } = parseBlockRequest({
      userId: req.params.userId,
      body: req.body,
    });
    const result = await blockUser(req.user.id, targetUserId, { reasonCode, sourceReviewId });
    sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
};

export const unblockUserById = async (req, res, next) => {
  try {
    const targetUserId = parseTargetUserId(req.params.userId);
    const result = await unblockUser(req.user.id, targetUserId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};
