import { afterEach, describe, expect, it } from 'vitest';

import { getOcrProvider } from '../../../src/services/providers/index.js';
import { mockOcrProvider, registerMockReceipt, clearMockReceipts } from '../../../src/services/providers/__mocks__/mockOcrProvider.js';
import { textractOcrProvider } from '../../../src/services/providers/textractProvider.js';

const originalEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalEnv;
  clearMockReceipts();
});

describe('getOcrProvider selection', () => {
  it('returns the mock when OCR_PROVIDER=mock in test env', () => {
    expect(getOcrProvider({ provider: 'mock' })).toBe(mockOcrProvider);
  });

  it('returns the textract adapter when provider=textract', () => {
    expect(getOcrProvider({ provider: 'textract' })).toBe(textractOcrProvider);
  });

  it('throws for an unknown provider', () => {
    expect(() => getOcrProvider({ provider: 'nope' })).toThrow(/Unsupported OCR provider/);
  });

  it('refuses the mock outside test/development', () => {
    process.env.NODE_ENV = 'production';
    expect(() => getOcrProvider({ provider: 'mock' })).toThrow(/not allowed/);
  });
});

describe('MockOcrProvider fail-closed', () => {
  it('throws when run outside test/development', async () => {
    registerMockReceipt('s3://b/r.jpg', { struct: { lineItems: [] } });
    process.env.NODE_ENV = 'production';
    await expect(mockOcrProvider.loadFile({ fileUrl: 's3://b/r.jpg' })).rejects.toThrow(/disabled/);
    await expect(mockOcrProvider.analyzeExpense({ fileUrl: 's3://b/r.jpg' })).rejects.toThrow(/disabled/);
  });

  it('returns the registered fixture struct in test env', async () => {
    registerMockReceipt('s3://b/r.jpg', {
      struct: { rawText: 'x', restaurantName: 'Pho', receiptTime: null, invoiceNo: 'I1', totalAmount: 1000, lineItems: [] },
    });
    const struct = await mockOcrProvider.analyzeExpense({ fileUrl: 's3://b/r.jpg' });
    expect(struct.restaurantName).toBe('Pho');
  });

  it('loadFile returns deterministic bytes for the fixture', async () => {
    registerMockReceipt('s3://b/r.jpg', { fileContent: 'abc', struct: { lineItems: [] } });
    const bytes = await mockOcrProvider.loadFile({ fileUrl: 's3://b/r.jpg' });
    expect(bytes.toString('utf8')).toBe('abc');
  });

  it('simulates a provider error when behavior=error', async () => {
    registerMockReceipt('s3://b/err.jpg', { behavior: 'error', errorMessage: 'boom' });
    await expect(mockOcrProvider.analyzeExpense({ fileUrl: 's3://b/err.jpg' })).rejects.toThrow('boom');
  });
});
