import { describe, expect, it } from 'vitest';
import {
  compareBillScanLine,
  overallBillScanResult,
} from '../../../src/services/billScanService.js';

describe('bill scan price rules', () => {
  it('accepts exactly 1000 VND and flags 1001 VND', () => {
    expect(compareBillScanLine({
      observedUnitPrice: 51_000,
      menuItemId: '00000000-0000-4000-8000-000000000001',
      expectedUnitPrice: 50_000,
    })).toEqual({
      priceDifference: 1000,
      result: 'MATCHED',
    });

    expect(compareBillScanLine({
      observedUnitPrice: 51_001,
      menuItemId: '00000000-0000-4000-8000-000000000001',
      expectedUnitPrice: 50_000,
    })).toEqual({
      priceDifference: 1001,
      result: 'PRICE_MISMATCH',
    });
  });

  it('keeps unmatched and unreadable lines inconclusive', () => {
    expect(compareBillScanLine({
      observedUnitPrice: 50_000,
      menuItemId: null,
      expectedUnitPrice: null,
    }).result).toBe('INCONCLUSIVE');
    expect(compareBillScanLine({
      observedUnitPrice: null,
      menuItemId: '00000000-0000-4000-8000-000000000001',
      expectedUnitPrice: 50_000,
    }).result).toBe('INCONCLUSIVE');
  });

  it('prioritizes mismatch, then inconclusive, then matched overall', () => {
    expect(overallBillScanResult([
      { result: 'MATCHED' },
      { result: 'INCONCLUSIVE' },
      { result: 'PRICE_MISMATCH' },
    ])).toBe('PRICE_MISMATCH');
    expect(overallBillScanResult([
      { result: 'MATCHED' },
      { result: 'INCONCLUSIVE' },
    ])).toBe('INCONCLUSIVE');
    expect(overallBillScanResult([{ result: 'MATCHED' }])).toBe('MATCHED');
  });
});
