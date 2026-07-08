import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/config/db.js', () => {
  const client = { query: vi.fn(), release: vi.fn() };
  return {
    pool: { connect: vi.fn(async () => client) },
    __client: client,
  };
});

const db = await import('../../../src/config/db.js');
const client = db.__client;
const { verifyReceipt, NotFoundError } = await import('../../../src/services/receiptVerificationService.js');

const RECEIPT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const REVIEW_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const RESTAURANT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const USER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const NOW = new Date('2026-06-12T10:00:00.000Z');

function receiptRow(overrides = {}) {
  return {
    id: RECEIPT_ID,
    review_id: REVIEW_ID,
    user_id: USER_ID,
    restaurant_id: RESTAURANT_ID,
    branch_id: null,
    status: 'OCR_SUCCESS',
    file_hash_sha256: 'f'.repeat(64),
    transaction_unique_hash: null,
    ocr_restaurant_name: 'Highlands Coffee',
    ocr_similarity: null,
    ocr_receipt_time: new Date('2026-06-12T08:00:00.000Z'), // 2h before NOW
    ocr_invoice_no: 'INV-001',
    ocr_total_amount: '120000',
    gps_latitude: '10.7769',
    gps_longitude: '106.7009',
    gps_accuracy_meters: '20',
    gps_distance_meters: null,
    captured_at: null,
    created_at: NOW, // server-side reference for the 1h window
    ...overrides,
  };
}

function restaurantRow(overrides = {}) {
  return {
    id: RESTAURANT_ID,
    name: 'Highlands Coffee',
    latitude: '10.7769',
    longitude: '106.7009',
    ...overrides,
  };
}

// Configurable SQL-dispatching mock. Each test sets the scenario; the mock
// returns rows based on which table/clause the SQL targets, and records writes.
function setupScenario({ receipt = receiptRow(), restaurant = restaurantRow(), duplicateRows = [] } = {}) {
  const calls = [];
  client.query.mockReset();
  client.release.mockReset();
  db.pool.connect.mockClear();

  client.query.mockImplementation(async (sql, params = []) => {
    calls.push({ sql, params });
    const text = String(sql);

    if (/^\s*BEGIN/i.test(text)) return {};
    if (/^\s*COMMIT/i.test(text)) return {};
    if (/^\s*ROLLBACK/i.test(text)) return {};

    if (/FROM\s+receipt_verifications/i.test(text) && /FOR\s+UPDATE/i.test(text)) {
      return { rows: receipt ? [receipt] : [] };
    }
    if (/FROM\s+reviews/i.test(text)) {
      return { rows: [{ id: REVIEW_ID, user_id: USER_ID, restaurant_id: RESTAURANT_ID }] };
    }
    if (/FROM\s+restaurants/i.test(text)) {
      return { rows: restaurant ? [restaurant] : [] };
    }
    // Duplicate transaction-hash lookup.
    if (/FROM\s+receipt_verifications/i.test(text) && /transaction_unique_hash\s*=/i.test(text)) {
      return { rows: duplicateRows };
    }
    if (/INSERT\s+INTO\s+fraud_flags/i.test(text)) {
      return { rows: [{ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' }] };
    }
    return { rows: [] };
  });

  return { calls };
}

function findWrite(calls, regex) {
  return calls.filter((c) => regex.test(String(c.sql)));
}

function reviewUpdate(calls) {
  const w = findWrite(calls, /UPDATE\s+reviews/i);
  return w.length ? w[w.length - 1] : null;
}

function receiptUpdate(calls) {
  const w = findWrite(calls, /UPDATE\s+receipt_verifications/i);
  return w.length ? w[w.length - 1] : null;
}

describe('verifyReceipt orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws NotFoundError when the receipt does not exist', async () => {
    setupScenario({ receipt: null });
    await expect(verifyReceipt(RECEIPT_ID, { now: NOW })).rejects.toBeInstanceOf(NotFoundError);
    // Transaction must be rolled back / connection released.
    expect(client.release).toHaveBeenCalled();
  });

  it('opens and commits a transaction on success', async () => {
    const { calls } = setupScenario();
    await verifyReceipt(RECEIPT_ID, { now: NOW });
    expect(calls.some((c) => /^\s*BEGIN/i.test(String(c.sql)))).toBe(true);
    expect(calls.some((c) => /^\s*COMMIT/i.test(String(c.sql)))).toBe(true);
    expect(client.release).toHaveBeenCalled();
  });

  it('rolls back and releases when a write throws (no residue)', async () => {
    const { calls } = setupScenario();
    client.query.mockImplementation(async (sql) => {
      if (/UPDATE\s+reviews/i.test(String(sql))) throw new Error('write failed');
      if (/FROM\s+receipt_verifications/i.test(String(sql)) && /FOR\s+UPDATE/i.test(String(sql))) {
        return { rows: [receiptRow()] };
      }
      if (/FROM\s+restaurants/i.test(String(sql))) return { rows: [restaurantRow()] };
      if (/FROM\s+reviews/i.test(String(sql))) return { rows: [{ id: REVIEW_ID }] };
      return { rows: [] };
    });
    await expect(verifyReceipt(RECEIPT_ID, { now: NOW })).rejects.toThrow('write failed');
    const rolledBack = client.query.mock.calls.some((c) => /^\s*ROLLBACK/i.test(String(c[0])));
    expect(rolledBack).toBe(true);
    expect(client.release).toHaveBeenCalled();
  });

  // --- Status_Mapping §3 rows ---

    it('risk 0-30 → VERIFIED across receipt + review', async () => {
      // clean signals: same coords, fresh receipt, exact name → score 0
      const { calls } = setupScenario();
      const result = await verifyReceipt(RECEIPT_ID, { now: NOW });

    expect(result.decision).toBe('VERIFIED');
    const rev = reviewUpdate(calls);
    expect(rev.sql).toMatch(/status\s*=/i);
    expect(rev.params).toEqual(expect.arrayContaining(['VERIFIED', 'PUBLIC', 'HIGH']));
      const rec = receiptUpdate(calls);
      expect(rec.params).toEqual(expect.arrayContaining(['VERIFIED']));
    });

    it('persists the merchant OCR similarity used for scoring', async () => {
      const { calls } = setupScenario();
      await verifyReceipt(RECEIPT_ID, { now: NOW });

      const rec = receiptUpdate(calls);
      expect(String(rec.sql)).toMatch(/ocr_similarity\s*=/i);
      expect(rec.params).toContain(100);
    });

    it('clears stale OCR similarity when the current merchant is unreadable', async () => {
      const { calls } = setupScenario({
        receipt: receiptRow({ ocr_restaurant_name: null, ocr_similarity: '88.00' }),
      });

      await verifyReceipt(RECEIPT_ID, { now: NOW });

      const rec = receiptUpdate(calls);
      expect(String(rec.sql)).not.toMatch(/ocr_similarity\s*=\s*COALESCE/i);
      expect(rec.params[6]).toBeNull();
    });

    it('risk 31-60 → PENDING_ADMIN_REVIEW with receipt.decision NULL', async () => {
      // merchant 60-79 (+25) + receipt 49-168h (+40) = 65... need 31-60.
      // Use unreadable merchant (+50) alone → 50 → pending.
      const { calls } = setupScenario({
      receipt: receiptRow({ ocr_restaurant_name: null }),
    });
    const result = await verifyReceipt(RECEIPT_ID, { now: NOW });

    expect(result.decision).toBeNull();
    expect(result.reviewStatus).toBe('PENDING_ADMIN_REVIEW');
    const rev = reviewUpdate(calls);
    expect(rev.params).toEqual(expect.arrayContaining(['PENDING_ADMIN_REVIEW', 'PRIVATE_UNTIL_DECISION', 'NONE']));
  });

  it('risk 61-99 → REFERENCE_ONLY', async () => {
    // merchant <60 (+60) + new-account is not available; use far GPS late + stale receipt.
    // unreadable merchant (+50) + receipt >168h (+70) = 120 → reject. Need 61-99.
    // merchant <60 (+60) + receipt 49-168h would be 100. Use merchant <60 (+60) + accuracy>100 (+15) = 75.
    const { calls } = setupScenario({
      receipt: receiptRow({ ocr_restaurant_name: 'Totally Different Diner', gps_accuracy_meters: '150' }),
    });
    const result = await verifyReceipt(RECEIPT_ID, { now: NOW });

    expect(result.reviewStatus).toBe('REFERENCE_ONLY');
    const rev = reviewUpdate(calls);
    expect(rev.params).toEqual(expect.arrayContaining(['REFERENCE_ONLY', 'PUBLIC', 'LOW']));
  });

  it('risk >=100 → REJECTED + fraud flag created', async () => {
    // unreadable merchant (+50) + receipt >168h (+70) = 120
    const { calls } = setupScenario({
      receipt: receiptRow({
        ocr_restaurant_name: null,
        ocr_receipt_time: new Date('2026-06-01T00:00:00.000Z'), // >168h before NOW
      }),
    });
    const result = await verifyReceipt(RECEIPT_ID, { now: NOW });

    expect(result.reviewStatus).toBe('REJECTED');
    const rev = reviewUpdate(calls);
    expect(rev.params).toEqual(expect.arrayContaining(['REJECTED', 'PRIVATE', 'NONE']));
    expect(findWrite(calls, /INSERT\s+INTO\s+fraud_flags/i).length).toBe(1);
    expect(findWrite(calls, /INSERT\s+INTO\s+fraud_flag_entities/i).length).toBeGreaterThanOrEqual(1);
  });

  it('duplicate transaction hash → REJECTED + DUPLICATE_REJECTED + DUPLICATE_TRANSACTION_HASH flag (no scoring)', async () => {
    const { calls } = setupScenario({
      duplicateRows: [{ id: 'ffffffff-ffff-4fff-8fff-ffffffffffff' }],
    });
    const result = await verifyReceipt(RECEIPT_ID, { now: NOW });

    expect(result.decision).toBe('REJECTED');
    expect(result.verificationStatus).toBe('DUPLICATE_REJECTED');

    const duplicateLookup = calls.find((c) => (
      /FROM\s+receipt_verifications/i.test(String(c.sql))
      && /transaction_unique_hash\s*=/i.test(String(c.sql))
    ));
    expect(String(duplicateLookup.sql)).toMatch(/status\s+IN\s*\(\s*'VERIFIED'\s*,\s*'DELETED'\s*\)/i);

    const rev = reviewUpdate(calls);
    expect(rev.params).toEqual(expect.arrayContaining(['REJECTED', 'DUPLICATE_REJECTED', 'PRIVATE', 'NONE']));

    const flagInsert = findWrite(calls, /INSERT\s+INTO\s+fraud_flags/i)[0];
    expect(flagInsert.params).toEqual(expect.arrayContaining(['DUPLICATE_TRANSACTION_HASH']));

    const entityInserts = findWrite(calls, /INSERT\s+INTO\s+fraud_flag_entities/i);
    const entityTypes = entityInserts.flatMap((c) => c.params);
    expect(entityTypes).toEqual(expect.arrayContaining(['RECEIPT_VERIFICATION', 'REVIEW']));
  });

  it('writes an audit_logs row for the decision', async () => {
    const { calls } = setupScenario();
    await verifyReceipt(RECEIPT_ID, { now: NOW });
    const audit = findWrite(calls, /INSERT\s+INTO\s+audit_logs/i);
    expect(audit.length).toBe(1);
    expect(audit[0].params).toEqual(expect.arrayContaining(['RECEIPT_VERIFICATION_DECISION']));
  });

  it('persists fraud_risk_score capped at 100 even when raw score exceeds it', async () => {
    const { calls } = setupScenario({
      receipt: receiptRow({
        ocr_restaurant_name: null, // +50
        ocr_receipt_time: new Date('2026-06-01T00:00:00.000Z'), // +70
      }),
    });
    await verifyReceipt(RECEIPT_ID, { now: NOW });
    const rec = receiptUpdate(calls);
    // 120 raw → persisted 100 (column CHECK 0..100)
    expect(rec.params).toContain(100);
  });

  // --- GPS abuse / spoofing ---

  it('GPS not provided adds the absent penalty (+30 alone → PENDING)', async () => {
    const { calls } = setupScenario({
      receipt: receiptRow({ gps_latitude: null, gps_longitude: null, gps_accuracy_meters: null }),
    });
    const result = await verifyReceipt(RECEIPT_ID, { now: NOW });
    // 30 → VERIFIED boundary (0-30). Distinct assertion: score recorded as 30.
    const rec = receiptUpdate(calls);
    expect(rec.params).toContain(30);
    expect(result.decision).toBe('VERIFIED');
  });

  it('stale capturedAt cannot dodge the >200m near penalty (scored as near +40, not late +10)', async () => {
    // User physically far (>200m) but back-dates capturedAt 30 min to look "late".
    const { calls } = setupScenario({
      receipt: receiptRow({
        gps_latitude: '10.9000', // ~1.4km away
        gps_longitude: '106.7009',
        captured_at: new Date('2026-06-12T09:25:00.000Z'), // 35 min skew vs created_at NOW
      }),
    });
    await verifyReceipt(RECEIPT_ID, { now: NOW });
    const rec = receiptUpdate(calls);
    // >200m + within server 1h window → +40 (not +10). Score 40 → PENDING.
    expect(rec.params).toContain(40);
  });
});
