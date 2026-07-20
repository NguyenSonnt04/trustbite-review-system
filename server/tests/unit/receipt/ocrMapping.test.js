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
  it('rejects HEIC by default because Textract AnalyzeExpense does not support it', () => {
    const res = validateReceiptFile({ fileUrl: 'r.heic', sizeBytes: 10 }, ocrConfig);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/Unsupported file type/);
  });
  it('accepts TIFF by default for Textract AnalyzeExpense receipts', () => {
    expect(validateReceiptFile({ fileUrl: 'r.tiff', sizeBytes: 10 }, ocrConfig)).toEqual({ ok: true });
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

  it('maps Vietnamese receipt amounts and day-month-year dates', () => {
    const struct = mapAnalyzeExpense(analyzeExpenseResponse({
      date: '10/06/2026',
      total: '1.234.567đ',
      items: [['Cà phê sữa', '2', '30.000', '60.000']],
    }));

    expect(struct.totalAmount).toBe(1234567);
    expect(struct.receiptTime?.toISOString().slice(0, 10)).toBe('2026-06-10');
    expect(struct.lineItems).toEqual([
      { name: 'Cà phê sữa', quantity: 2, unitPrice: 30000, totalPrice: 60000 },
    ]);
  });

  it('keeps fractional quantities separate from VND amount grouping', () => {
    const struct = mapAnalyzeExpense(analyzeExpenseResponse({
      items: [
        ['Hạt rang theo kg', '0.500', '200.000', '100.000'],
        ['Trà theo kg', '0,250', '120.000', '30.000'],
      ],
    }));

    expect(struct.lineItems).toEqual([
      { name: 'Hạt rang theo kg', quantity: 0.5, unitPrice: 200000, totalPrice: 100000 },
      { name: 'Trà theo kg', quantity: 0.25, unitPrice: 120000, totalPrice: 30000 },
    ]);
  });

  it('derives unit price from total and quantity when UNIT_PRICE is absent', () => {
    const response = analyzeExpenseResponse({
      items: [['Cà phê sữa', '2', null, '60.000']],
    });
    response.ExpenseDocuments[0].LineItemGroups[0].LineItems[0].LineItemExpenseFields =
      response.ExpenseDocuments[0].LineItemGroups[0].LineItems[0].LineItemExpenseFields
        .filter((field) => field.Type.Text !== 'UNIT_PRICE');

    expect(mapAnalyzeExpense(response).lineItems).toEqual([
      { name: 'Cà phê sữa', quantity: 2, unitPrice: 30000, totalPrice: 60000 },
    ]);
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
