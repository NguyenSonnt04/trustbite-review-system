import { createReport } from '../services/moderationService.js';
import { createHttpError } from '../utils/httpErrors.js';
import { sendSuccess } from '../utils/responses.js';

/**
 * moderation controller — HTTP boundary for user-submitted reports.
 *
 * Per the project architecture rule, unknown input is parsed and validated here
 * before the service/domain logic runs.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ENTITY_TYPES = ['REVIEW', 'USER', 'RESTAURANT'];
const REASON_CODE_MAX_LENGTH = 60;
const DESCRIPTION_MAX_LENGTH = 1000;

export function parseReportRequest(body) {
  if (body === undefined || body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'Request body must be an object');
  }

  const { entityType, entityId, reasonCode, description } = body;

  if (typeof entityType !== 'string' || !ENTITY_TYPES.includes(entityType)) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'entityType must be one of REVIEW, USER, RESTAURANT');
  }

  if (typeof entityId !== 'string' || !UUID_REGEX.test(entityId)) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'entityId must be a valid UUID');
  }

  if (typeof reasonCode !== 'string' || reasonCode.trim().length === 0) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'reasonCode is required');
  }
  const normalizedReasonCode = reasonCode.trim();
  if (normalizedReasonCode.length > REASON_CODE_MAX_LENGTH) {
    throw createHttpError(422, 'VALIDATION_ERROR', `reasonCode must be at most ${REASON_CODE_MAX_LENGTH} characters`);
  }

  let normalizedDescription = null;
  if (description !== undefined && description !== null) {
    if (typeof description !== 'string') {
      throw createHttpError(422, 'VALIDATION_ERROR', 'description must be a string');
    }
    const trimmed = description.trim();
    if (trimmed.length > DESCRIPTION_MAX_LENGTH) {
      throw createHttpError(422, 'VALIDATION_ERROR', `description must be at most ${DESCRIPTION_MAX_LENGTH} characters`);
    }
    normalizedDescription = trimmed.length > 0 ? trimmed : null;
  }

  return {
    entityType,
    entityId,
    reasonCode: normalizedReasonCode,
    description: normalizedDescription,
  };
}

export const submitReport = async (req, res, next) => {
  try {
    const parsed = parseReportRequest(req.body);
    const result = await createReport(req.user.id, parsed);
    sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
};
