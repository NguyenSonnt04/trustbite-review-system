import { describe, expect, it } from 'vitest';
import { parseReportRequest } from '../../../src/controllers/moderation.js';

const ENTITY_ID = '22222222-2222-4222-8222-222222222222';

const validBody = (overrides = {}) => ({
  entityType: 'REVIEW',
  entityId: ENTITY_ID,
  reasonCode: 'SPAM_OR_FAKE',
  ...overrides,
});

describe('parseReportRequest boundary validation', () => {
  it('parses and normalizes a valid report request', () => {
    const result = parseReportRequest(validBody({ reasonCode: '  SPAM_OR_FAKE  ', description: '  seeding  ' }));
    expect(result).toEqual({
      entityType: 'REVIEW',
      entityId: ENTITY_ID,
      reasonCode: 'SPAM_OR_FAKE',
      description: 'seeding',
    });
  });

  it('defaults an absent or blank description to null', () => {
    expect(parseReportRequest(validBody()).description).toBeNull();
    expect(parseReportRequest(validBody({ description: '   ' })).description).toBeNull();
  });

  it('rejects a non-object body', () => {
    expect(() => parseReportRequest(undefined))
      .toThrowError(expect.objectContaining({ statusCode: 422, code: 'VALIDATION_ERROR' }));
    expect(() => parseReportRequest([]))
      .toThrowError(expect.objectContaining({ statusCode: 422, code: 'VALIDATION_ERROR' }));
  });

  it('rejects an invalid entityType', () => {
    expect(() => parseReportRequest(validBody({ entityType: 'COMMENT' })))
      .toThrowError(expect.objectContaining({ statusCode: 422, code: 'VALIDATION_ERROR' }));
  });

  it('rejects an invalid entityId UUID', () => {
    expect(() => parseReportRequest(validBody({ entityId: 'nope' })))
      .toThrowError(expect.objectContaining({ statusCode: 422, code: 'VALIDATION_ERROR' }));
  });

  it('rejects a missing reasonCode', () => {
    expect(() => parseReportRequest(validBody({ reasonCode: '   ' })))
      .toThrowError(expect.objectContaining({ statusCode: 422, code: 'VALIDATION_ERROR' }));
  });

  it('rejects a reasonCode longer than 60 characters', () => {
    expect(() => parseReportRequest(validBody({ reasonCode: 'x'.repeat(61) })))
      .toThrowError(expect.objectContaining({ statusCode: 422, code: 'VALIDATION_ERROR' }));
  });

  it('rejects a non-string description', () => {
    expect(() => parseReportRequest(validBody({ description: 123 })))
      .toThrowError(expect.objectContaining({ statusCode: 422, code: 'VALIDATION_ERROR' }));
  });

  it('rejects a description longer than 1000 characters', () => {
    expect(() => parseReportRequest(validBody({ description: 'x'.repeat(1001) })))
      .toThrowError(expect.objectContaining({ statusCode: 422, code: 'VALIDATION_ERROR' }));
  });
});
