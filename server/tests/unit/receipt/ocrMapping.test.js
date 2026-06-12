import { describe, expect, it } from 'vitest';

import {
  extractExtension,
  validateReceiptFile,
  mapAnalyzeExpense,
} from '../../../src/services/providers/ocrMapping.js';
import { getOcrConfig } from '../../../src/config/ocr.js';

const ocrConfig = getOcrConfig();

describe('extractExtension', () => {
  it('reads the extension from a bare key', () => {
    expect(extractExtension('receipts/abc.JPG')).toBe('jpg');
  });
  it('reads the extension from an s3 url with query', () => {
    expect(extractExtension('s3://bucket/path/to/file.png?x=1')).toBe('png');
  });
  it('returns empty when no extension', () => {
    expect(extractExtension('receipts/noext')).toBe('');
    expect(extractExtension(null)).toBe('');
  });
});

describe('validateReceiptFile', () => {
  it('accepts an allowed extension within size', () => {
    expect(validateReceiptFile({ fileUrl: 'r.jpg', sizeBytes: 1000 }, ocrConfig)).toEqual({ ok: true });
  });
  it('rejects an unsupported extension before scoring', () => {
    const res = validateReceiptFile({ fileUrl: 'r.exe', sizeBytes: 10 }, ocrConfig);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/Unsupported file type/);
  });
  it('rejects a file over the size cap', () => {
    const res = validateReceiptFile({ fileUrl: 'r.jpg', sizeBytes: ocrConfig.maxFileBytes + 1 }, ocrConfig);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/exceeds/);
  });
});

// A representative AnalyzeExpense response.
function analyzeExpenseResponse({ vendor = 'Highlands Coffee', date = '2026-06-10', id = 'INV-001', total = '120,000 ₫', items = [['Cafe Sua', '2', '30000', '60000']] } = {}) {
  const summaryField = (type, text) =>
    text == null ? null : { Type: { Text: type }, ValueDetection: { Text: text } };
  const summaryFields = [
    summaryField('VENDOR_NAME', vendor),
    summaryField('INVOICE_RECEIPT_DATE', date),
    summaryField('INVOICE_RECEIPT_ID', id),
    summaryField('TOTAL', total),
  ].filter(Boolean);

  const lineItems = items.map(([name, qty, unit, price]) => ({
    LineItemExpenseFields: [
      { Type: { Text: 'ITEM' }, ValueDetection: { Text: name } },
      { Type: { Text: 'QUANTITY' }, ValueDetection: { Text: qty } },
      { Type: { Text: 'UNIT_PRICE' }, ValueDetection: { Text: unit } },
      { Type: { Text: 'PRICE' }, ValueDetection: { Text: price } },
    ],
  }));

  return { ExpenseDocuments: [{ SummaryFields: summaryFields, LineItemGroups: [{ LineItems: lineItems }] }] };
}

describe('mapAnalyzeExpense', () => {
  it('maps summary fields and line items', () => {
    const struct = mapAnalyzeExpense(analyzeExpenseResponse());
    expect(struct.restaurantName).toBe('Highlands Coffee');
    expect(struct.invoiceNo).toBe('INV-001');
    expect(struct.totalAmount).toBe(120000); // currency symbol + comma stripped
    expect(struct.receiptTime).toBeInstanceOf(Date);
    expect(struct.lineItems).toEqual([
      { name: 'Cafe Sua', quantity: 2, unitPrice: 30000, totalPrice: 60000 },
    ]);
    expect(struct.rawText).toContain('Cafe Sua');
  });

  it('returns nulls for missing summary fields (unreadable)', () => {
    const struct = mapAnalyzeExpense({ ExpenseDocuments: [{ SummaryFields: [], LineItemGroups: [] }] });
    expect(struct.restaurantName).toBeNull();
    expect(struct.receiptTime).toBeNull();
    expect(struct.invoiceNo).toBeNull();
    expect(struct.totalAmount).toBeNull();
    expect(struct.lineItems).toEqual([]);
  });

  it('coerces a non-numeric total to null', () => {
    const struct = mapAnalyzeExpense(analyzeExpenseResponse({ total: 'N/A' }));
    expect(struct.totalAmount).toBeNull();
  });

  it('coerces an unparseable date to null', () => {
    const struct = mapAnalyzeExpense(analyzeExpenseResponse({ date: 'not-a-date' }));
    expect(struct.receiptTime).toBeNull();
  });

  it('handles an empty/garbage response without throwing', () => {
    expect(mapAnalyzeExpense({}).restaurantName).toBeNull();
    expect(mapAnalyzeExpense(null).lineItems).toEqual([]);
  });

  it('skips line items with no name and defaults quantity to 1', () => {
    const resp = analyzeExpenseResponse({ items: [['', '1', '0', '0'], ['Tra Da', '', '5000', '5000']] });
    const struct = mapAnalyzeExpense(resp);
    expect(struct.lineItems).toEqual([
      { name: 'Tra Da', quantity: 1, unitPrice: 5000, totalPrice: 5000 },
    ]);
  });
});
