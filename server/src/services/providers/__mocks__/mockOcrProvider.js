// Mock OCR provider — deterministic test/local double. Fails closed outside
// test/development so it can never run in staging/production. Tests register
// fixtures keyed by the receipt's file_url; an optional behavior can simulate a
// provider timeout (delayMs) or error to exercise the worker's retry/degrade
// path. The split mirrors the real adapter: loadFile() returns bytes (fast),
// analyzeExpense() runs the slow extraction (where delay/error are simulated).

const ALLOWED_ENVS = new Set(['test', 'development']);

const fixtures = new Map(); // fileUrl -> { struct, fileContent?, behavior?, delayMs?, errorMessage? }

export function registerMockReceipt(fileUrl, fixture) {
  fixtures.set(fileUrl, fixture);
}

export function clearMockReceipts() {
  fixtures.clear();
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function assertEnv() {
  if (!ALLOWED_ENVS.has(process.env.NODE_ENV)) {
    throw new Error(
      `MockOcrProvider is disabled in NODE_ENV='${process.env.NODE_ENV}'. ` +
        'Set OCR_PROVIDER=textract outside test/local.',
    );
  }
}

function fixtureFor(fileUrl) {
  const fixture = fixtures.get(fileUrl);
  if (!fixture) throw new Error(`No mock OCR fixture registered for ${fileUrl}`);
  return fixture;
}

export class MockOcrProvider {
  provider = 'mock';

  async loadFile({ fileUrl }) {
    assertEnv();
    const fixture = fixtureFor(fileUrl);
    // Bytes drive the SHA-256 the pipeline computes; fileContent lets a test
    // force two receipts to share a content hash (duplicate scenario).
    return Buffer.from(fixture.fileContent ?? fileUrl, 'utf8');
  }

  async analyzeExpense({ fileUrl }) {
    assertEnv();
    const fixture = fixtureFor(fileUrl);
    if (fixture.delayMs) await delay(fixture.delayMs);
    if (fixture.behavior === 'error') {
      throw new Error(fixture.errorMessage || 'Mock OCR provider error');
    }
    return (
      fixture.struct ?? {
        rawText: null,
        restaurantName: null,
        receiptTime: null,
        invoiceNo: null,
        totalAmount: null,
        lineItems: [],
      }
    );
  }
}

export const mockOcrProvider = new MockOcrProvider();
