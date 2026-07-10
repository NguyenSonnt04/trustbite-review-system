import { describe, expect, it } from 'vitest';
import { parseBlockRequest, parseTargetUserId } from '../../../src/controllers/userBlock.js';

const TARGET_ID = '22222222-2222-4222-8222-222222222222';
const REVIEW_ID = '44444444-4444-4444-8444-444444444444';

describe('userBlock boundary validation', () => {
  it('parses a valid block request into normalized values', () => {
    const result = parseBlockRequest({
      userId: TARGET_ID,
      body: { reasonCode: '  ABUSIVE_LANGUAGE  ', sourceReviewId: REVIEW_ID },
    });

    expect(result).toEqual({
      targetUserId: TARGET_ID,
      reasonCode: 'ABUSIVE_LANGUAGE',
      sourceReviewId: REVIEW_ID,
    });
  });

  it('defaults optional fields to null when body is empty or missing', () => {
    expect(parseBlockRequest({ userId: TARGET_ID, body: {} })).toEqual({
      targetUserId: TARGET_ID,
      reasonCode: null,
      sourceReviewId: null,
    });
    expect(parseBlockRequest({ userId: TARGET_ID })).toEqual({
      targetUserId: TARGET_ID,
      reasonCode: null,
      sourceReviewId: null,
    });
  });

  it('treats a blank reasonCode as null', () => {
    expect(parseBlockRequest({ userId: TARGET_ID, body: { reasonCode: '   ' } }).reasonCode).toBeNull();
  });

  it('rejects an invalid target UUID', () => {
    expect(() => parseTargetUserId('not-a-uuid'))
      .toThrowError(expect.objectContaining({ statusCode: 422, code: 'VALIDATION_ERROR' }));
  });

  it('rejects a reasonCode longer than 60 characters', () => {
    expect(() => parseBlockRequest({ userId: TARGET_ID, body: { reasonCode: 'x'.repeat(61) } }))
      .toThrowError(expect.objectContaining({ statusCode: 422, code: 'VALIDATION_ERROR' }));
  });

  it('rejects a non-string reasonCode', () => {
    expect(() => parseBlockRequest({ userId: TARGET_ID, body: { reasonCode: 123 } }))
      .toThrowError(expect.objectContaining({ statusCode: 422, code: 'VALIDATION_ERROR' }));
  });

  it('rejects an invalid sourceReviewId', () => {
    expect(() => parseBlockRequest({ userId: TARGET_ID, body: { sourceReviewId: 'nope' } }))
      .toThrowError(expect.objectContaining({ statusCode: 422, code: 'VALIDATION_ERROR' }));
  });

  it('rejects a non-object body', () => {
    expect(() => parseBlockRequest({ userId: TARGET_ID, body: 'oops' }))
      .toThrowError(expect.objectContaining({ statusCode: 422, code: 'VALIDATION_ERROR' }));
  });
});
