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

const quantityOrNull = (v) => {
  if (v == null) return null;
  const cleaned = normalizeDecimalNumber(v);
  if (cleaned == null) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

const amountOrNull = (v) => {
  if (v == null) return null;
  const cleaned = normalizeCurrencyAmount(v);
  if (cleaned == null) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

function normalizeDecimalNumber(value) {
  const cleaned = String(value)
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^0-9.,-]/g, '');

  if (cleaned === '' || cleaned === '-' || cleaned === '.' || cleaned === ',') return null;

  if (cleaned.includes(',') && !cleaned.includes('.')) {
    const parts = cleaned.split(',');
    return parts.length === 2 ? parts.join('.') : parts.join('');
  }

  if (cleaned.includes(',') && cleaned.includes('.')) {
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    if (lastComma > lastDot) {
      return cleaned.replace(/\./g, '').replace(',', '.');
    }
    return cleaned.replace(/,/g, '');
  }

  return cleaned;
}

function normalizeCurrencyAmount(value) {
  const cleaned = String(value)
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^0-9.,-]/g, '');

  if (cleaned === '' || cleaned === '-' || cleaned === '.' || cleaned === ',') return null;

  const sign = cleaned.startsWith('-') ? '-' : '';
  const unsigned = cleaned.replace(/-/g, '');
  if (!/\d/.test(unsigned)) return null;

  const separators = [...unsigned].filter((char) => char === '.' || char === ',');
  if (separators.length === 0) return `${sign}${unsigned}`;

  const lastSeparatorIndex = Math.max(unsigned.lastIndexOf('.'), unsigned.lastIndexOf(','));
  const lastSeparator = unsigned[lastSeparatorIndex];
  const trailingDigits = unsigned.slice(lastSeparatorIndex + 1);
  const separatorKinds = new Set(separators);

  if (separatorKinds.size === 1) {
    const parts = unsigned.split(lastSeparator);
    const looksGrouped = parts.length > 2 || trailingDigits.length === 3;
    return `${sign}${looksGrouped ? parts.join('') : parts.join('.')}`;
  }

  const withoutGroupSeparators = unsigned
    .split(lastSeparator === '.' ? ',' : '.')
    .join('');

  if (trailingDigits.length === 3) {
    return `${sign}${withoutGroupSeparators.replace(/[.,]/g, '')}`;
  }

  return `${sign}${withoutGroupSeparators.replace(lastSeparator, '.')}`;
}

const dateOrNull = (v) => {
  if (!v) return null;
  const d = parseReceiptDate(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

function parseReceiptDate(value) {
  const text = String(value).trim();

  const numericDate = text.match(
    /^(\d{1,4})[./-](\d{1,2})[./-](\d{1,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );

  if (numericDate) {
    const [, first, second, third, hour = '0', minute = '0', secondOfMinute = '0'] = numericDate;
    const firstNumber = Number(first);
    const secondNumber = Number(second);
    const thirdNumber = Number(third);

    const year = first.length === 4 ? firstNumber : normalizeYear(thirdNumber);
    const month = first.length === 4 ? secondNumber : secondNumber;
    const day = first.length === 4 ? thirdNumber : firstNumber;
    const parsed = new Date(Date.UTC(year, month - 1, day, Number(hour), Number(minute), Number(secondOfMinute)));

    if (
      parsed.getUTCFullYear() === year
      && parsed.getUTCMonth() === month - 1
      && parsed.getUTCDate() === day
      && parsed.getUTCHours() === Number(hour)
      && parsed.getUTCMinutes() === Number(minute)
      && parsed.getUTCSeconds() === Number(secondOfMinute)
    ) {
      return parsed;
    }
  }

  return new Date(value);
}

function normalizeYear(year) {
  return year < 100 ? 2000 + year : year;
}

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
      const quantity = quantityOrNull(lineItemValue(fields, 'QUANTITY'));
      const unitPrice = amountOrNull(lineItemValue(fields, 'UNIT_PRICE'));
      const totalPrice = amountOrNull(lineItemValue(fields, 'PRICE'));
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
      totalAmount: amountOrNull(summaryValue(summaryFields, 'TOTAL')),
    lineItems,
  };
}
