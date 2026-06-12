// Pure helpers for the OCR pipeline: file validation and AnalyzeExpense mapping.
// No I/O, no provider clients — exhaustively unit-testable.

/**
 * Extract a lowercase extension from an S3 key / URL (no leading dot).
 */
export function extractExtension(fileUrl) {
  if (!fileUrl) return '';
  const clean = String(fileUrl).split(/[?#]/)[0];
  const base = clean.substring(clean.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot >= 0 ? base.slice(dot + 1).toLowerCase() : '';
}

/**
 * Validate a receipt file against the configured allowlist + size cap.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validateReceiptFile({ fileUrl, sizeBytes }, ocrConfig) {
  const ext = extractExtension(fileUrl);
  if (!ext || !ocrConfig.allowedExtensions.includes(ext)) {
    return { ok: false, reason: `Unsupported file type: ${ext || 'unknown'}` };
  }
  if (sizeBytes != null && Number(sizeBytes) > ocrConfig.maxFileBytes) {
    return { ok: false, reason: `File exceeds ${ocrConfig.maxFileBytes} bytes` };
  }
  return { ok: true };
}

const numOrNull = (v) => {
  if (v == null) return null;
  // Strip currency symbols, thousands separators, spaces; keep digits/.,-
  const cleaned = String(v).replace(/[^0-9.,-]/g, '').replace(/,/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

const dateOrNull = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const strOrNull = (v) => {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

// Pull a typed summary field value out of AnalyzeExpense SummaryFields.
function summaryValue(summaryFields, type) {
  const field = summaryFields.find((f) => f?.Type?.Text === type);
  return field?.ValueDetection?.Text ?? null;
}

// Pull a line-item cell value by expense-row field type.
function lineItemValue(fields, type) {
  const field = fields.find((f) => f?.Type?.Text === type);
  return field?.ValueDetection?.Text ?? null;
}

/**
 * Map a Textract AnalyzeExpense response to the normalized OCR struct.
 * Defensive: missing/garbled fields become null (Task 4.4 scores them as
 * "unreadable") rather than throwing.
 *
 * @param {object} response - { ExpenseDocuments: [...] }
 * @returns {{ rawText, restaurantName, receiptTime, invoiceNo, totalAmount, lineItems }}
 */
export function mapAnalyzeExpense(response) {
  const docs = Array.isArray(response?.ExpenseDocuments) ? response.ExpenseDocuments : [];
  const doc = docs[0] ?? {};
  const summaryFields = Array.isArray(doc.SummaryFields) ? doc.SummaryFields : [];
  const groups = Array.isArray(doc.LineItemGroups) ? doc.LineItemGroups : [];

  const lineItems = [];
  const rawParts = [];

  for (const group of groups) {
    const rows = Array.isArray(group?.LineItems) ? group.LineItems : [];
    for (const row of rows) {
      const fields = Array.isArray(row?.LineItemExpenseFields) ? row.LineItemExpenseFields : [];
      const name = strOrNull(lineItemValue(fields, 'ITEM'));
      if (!name) continue;
      const quantity = numOrNull(lineItemValue(fields, 'QUANTITY'));
      const unitPrice = numOrNull(lineItemValue(fields, 'UNIT_PRICE'));
      const totalPrice = numOrNull(lineItemValue(fields, 'PRICE'));
      lineItems.push({
        name,
        quantity: quantity != null && quantity > 0 ? quantity : 1,
        unitPrice: unitPrice != null && unitPrice >= 0 ? unitPrice : (totalPrice ?? 0),
        totalPrice: totalPrice != null && totalPrice >= 0 ? totalPrice : 0,
      });
      rawParts.push(name);
    }
  }

  for (const f of summaryFields) {
    const t = f?.ValueDetection?.Text;
    if (t) rawParts.push(t);
  }

  return {
    rawText: rawParts.join('\n') || null,
    restaurantName: strOrNull(summaryValue(summaryFields, 'VENDOR_NAME')),
    receiptTime: dateOrNull(summaryValue(summaryFields, 'INVOICE_RECEIPT_DATE')),
    invoiceNo: strOrNull(summaryValue(summaryFields, 'INVOICE_RECEIPT_ID')),
    totalAmount: numOrNull(summaryValue(summaryFields, 'TOTAL')),
    lineItems,
  };
}
