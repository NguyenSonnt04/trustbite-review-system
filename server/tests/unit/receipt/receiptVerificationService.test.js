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
    request_ip: null,
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

function branchRow(overrides = {}) {
  return {
    id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    parent_restaurant_id: RESTAURANT_ID,
    name: 'Highlands Coffee',
    latitude: '10.7769',
    longitude: '106.7009',
    ...overrides,
  };
}

// Configurable SQL-dispatching mock. Each test sets the scenario; the mock
// returns rows based on which table/clause the SQL targets, and records writes.
function setupScenario({
  receipt = receiptRow(),
  restaurant = restaurantRow(),
  branch = null,
  duplicateRows = [],
  user = { created_at: new Date('2026-06-01T00:00:00.000Z'), exp_points: 0 },
  earlierReviewRows = [],
  rejectedCount = 0,
  sameIpRows = [],
  reviewCreatedAt = NOW,
} = {}) {
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
    // Duplicate transaction-hash lookup.
    if (/FROM\s+receipt_verifications/i.test(text) && /transaction_unique_hash\s*=/i.test(text)) {
      return { rows: duplicateRows };
    }
    // Behavioral: rejected-receipt velocity count.
    if (/FROM\s+receipt_verifications/i.test(text) && /status\s*=\s*'REJECTED'/i.test(text)) {
      return { rows: [{ count: rejectedCount }] };
    }
    // Behavioral: multi-account same-IP lookup.
    if (/FROM\s+receipt_verifications/i.test(text) && /request_ip\s*=/i.test(text)) {
      return { rows: sameIpRows };
    }
    // Behavioral: earlier-review existence check (new-account + first-review).
    if (/FROM\s+reviews/i.test(text) && /created_at\s*</i.test(text)) {
      return { rows: earlierReviewRows };
    }
    if (/FROM\s+reviews/i.test(text)) {
      return {
        rows: [{
          id: REVIEW_ID,
          user_id: USER_ID,
          restaurant_id: RESTAURANT_ID,
          status: 'SUBMITTED',
          verification_status: 'PROCESSING',
          trust_label: 'PROCESSING',
          public_visibility: 'PRIVATE_UNTIL_DECISION',
          trust_weight_bucket: 'NONE',
          created_at: reviewCreatedAt,
        }],
      };
    }
    if (/FROM\s+users/i.test(text)) {
      return { rows: user ? [user] : [] };
    }
    if (/FROM\s+restaurant_branches/i.test(text)) {
      if (!branch) return { rows: [] };
      if (params.length >= 2) {
        return { rows: branch.parent_restaurant_id === params[1] ? [branch] : [] };
      }
      return { rows: [branch] };
    }
    if (/FROM\s+restaurants/i.test(text)) {
      return { rows: restaurant ? [restaurant] : [] };
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

  it('returns an already processed terminal decision without rescoring', async () => {
    const { calls } = setupScenario({
      receipt: receiptRow({
        status: 'VERIFIED',
        decision: 'VERIFIED',
        fraud_risk_score: 0,
      }),
    });

    const result = await verifyReceipt(RECEIPT_ID, { now: NOW });

    expect(result).toMatchObject({
      decision: 'VERIFIED',
      receiptStatus: 'VERIFIED',
      alreadyProcessed: true,
    });
    expect(reviewUpdate(calls)).toBeNull();
    expect(receiptUpdate(calls)).toBeNull();
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
    expect(findWrite(calls, /UPDATE\s+restaurants/i)).toHaveLength(1);
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

    it('falls back to the receipt restaurant when branch_id belongs to another restaurant', async () => {
      const { calls } = setupScenario({
        receipt: receiptRow({ branch_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' }),
        branch: branchRow({
          parent_restaurant_id: '99999999-9999-4999-8999-999999999999',
        }),
        restaurant: restaurantRow({
          name: 'Faraway Noodles',
          latitude: '10.9000',
          longitude: '106.9000',
        }),
      });

      const result = await verifyReceipt(RECEIPT_ID, { now: NOW });

      expect(result.reviewStatus).toBe('REJECTED');
      const branchLookup = calls.find((c) => /FROM\s+restaurant_branches/i.test(String(c.sql)));
      expect(branchLookup.params).toEqual([
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        RESTAURANT_ID,
      ]);
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

  // --- Behavioral / velocity / device signals (TB-FRAUD-005, Anti-Fraud §4.1) ---

  it('new account (<24h) on its first review adds +15', async () => {
    const { calls } = setupScenario({
      user: { created_at: new Date(NOW.getTime() - 60 * 60 * 1000) }, // 1h old
      earlierReviewRows: [], // no earlier review → first review
    });
    const result = await verifyReceipt(RECEIPT_ID, { now: NOW });

    const rec = receiptUpdate(calls);
    expect(rec.params).toContain(15);
    expect(result.decision).toBe('VERIFIED'); // 15 stays in the 0-30 bucket
    expect(result.breakdown.map((b) => b.code)).toContain('NEW_ACCOUNT_FIRST_REVIEW');
  });

  it('measures new-account age at review submission time, not the (async) decision time', async () => {
    // Account created 23h before the review was submitted (still new), but the
    // OCR/decision runs 30h after account creation. Anchoring on submission keeps
    // the +15; anchoring on `now` would wrongly drop it.
    const accountCreatedAt = new Date('2026-06-11T05:00:00.000Z');
    const reviewSubmittedAt = new Date(accountCreatedAt.getTime() + 23 * 60 * 60 * 1000); // T0+23h
    const decisionNow = new Date(accountCreatedAt.getTime() + 30 * 60 * 60 * 1000); // T0+30h

    const { calls } = setupScenario({
      user: { created_at: accountCreatedAt },
      reviewCreatedAt: reviewSubmittedAt,
      earlierReviewRows: [],
      // Keep every other signal clean at decisionNow: fresh receipt, matching GPS.
      receipt: receiptRow({
        ocr_receipt_time: new Date(decisionNow.getTime() - 60 * 60 * 1000), // 1h old
        created_at: decisionNow,
      }),
    });
    const result = await verifyReceipt(RECEIPT_ID, { now: decisionNow });

    const rec = receiptUpdate(calls);
    expect(rec.params).toContain(15);
    expect(result.breakdown.map((b) => b.code)).toContain('NEW_ACCOUNT_FIRST_REVIEW');
  });

  it('new account that already has an earlier review adds no new-account penalty', async () => {
    const { calls } = setupScenario({
      user: { created_at: new Date(NOW.getTime() - 60 * 60 * 1000) },
      earlierReviewRows: [{ '?column?': 1 }], // an earlier review exists
    });
    await verifyReceipt(RECEIPT_ID, { now: NOW });

    const rec = receiptUpdate(calls);
    expect(rec.params).toContain(0); // clean signals, no +15
  });

  it('established account (>24h) adds no new-account penalty', async () => {
    const { calls } = setupScenario({
      user: { created_at: new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000) }, // 10 days old
    });
    await verifyReceipt(RECEIPT_ID, { now: NOW });

    const rec = receiptUpdate(calls);
    expect(rec.params).toContain(0);
  });

  it('>=3 rejected receipts in the trailing 7d adds +40 → PENDING', async () => {
    const { calls } = setupScenario({ rejectedCount: 3 });
    const result = await verifyReceipt(RECEIPT_ID, { now: NOW });

    const rec = receiptUpdate(calls);
    expect(rec.params).toContain(40);
    expect(result.reviewStatus).toBe('PENDING_ADMIN_REVIEW');
    expect(result.breakdown.map((b) => b.code)).toContain('MANY_REJECTED_RECEIPTS');
  });

  it('fewer than 3 rejected receipts adds no velocity penalty', async () => {
    const { calls } = setupScenario({ rejectedCount: 2 });
    const result = await verifyReceipt(RECEIPT_ID, { now: NOW });

    const rec = receiptUpdate(calls);
    expect(rec.params).toContain(0);
    expect(result.decision).toBe('VERIFIED');
  });

  it('another account uploading from the same IP for the same restaurant within 24h adds +50', async () => {
    const { calls } = setupScenario({
      receipt: receiptRow({ request_ip: '203.0.113.7' }),
      sameIpRows: [{ '?column?': 1 }],
    });
    const result = await verifyReceipt(RECEIPT_ID, { now: NOW });

    const rec = receiptUpdate(calls);
    expect(rec.params).toContain(50);
    expect(result.reviewStatus).toBe('PENDING_ADMIN_REVIEW');
    expect(result.breakdown.map((b) => b.code)).toContain('MULTI_ACCOUNT_SAME_DEVICE');

    // The same-IP lookup must exclude the current user and scope to the restaurant.
    const sameIpLookup = calls.find((c) => (
      /FROM\s+receipt_verifications/i.test(String(c.sql)) && /request_ip\s*=/i.test(String(c.sql))
    ));
    expect(sameIpLookup.params).toEqual(['203.0.113.7', RESTAURANT_ID, USER_ID, expect.any(Date)]);
  });

  it('same IP with no other account present adds no device penalty', async () => {
    const { calls } = setupScenario({
      receipt: receiptRow({ request_ip: '203.0.113.7' }),
      sameIpRows: [],
    });
    const result = await verifyReceipt(RECEIPT_ID, { now: NOW });

    const rec = receiptUpdate(calls);
    expect(rec.params).toContain(0);
    expect(result.decision).toBe('VERIFIED');
  });

  it('no request IP skips the same-IP lookup entirely', async () => {
    const { calls } = setupScenario({ receipt: receiptRow({ request_ip: null }) });
    await verifyReceipt(RECEIPT_ID, { now: NOW });

    const sameIpLookup = calls.find((c) => (
      /FROM\s+receipt_verifications/i.test(String(c.sql)) && /request_ip\s*=/i.test(String(c.sql))
    ));
    expect(sameIpLookup).toBeUndefined();
  });

  it('stacks behavioral signals: new account + many rejected + same IP → REJECTED with fraud flag', async () => {
    const { calls } = setupScenario({
      receipt: receiptRow({ request_ip: '203.0.113.7' }),
      user: { created_at: new Date(NOW.getTime() - 60 * 60 * 1000) },
      earlierReviewRows: [],
      rejectedCount: 3,
      sameIpRows: [{ '?column?': 1 }],
    });
    const result = await verifyReceipt(RECEIPT_ID, { now: NOW });

    // 15 + 40 + 50 = 105 → REJECTED and a fraud flag on the dominant signal.
    expect(result.reviewStatus).toBe('REJECTED');
    expect(findWrite(calls, /INSERT\s+INTO\s+fraud_flags/i).length).toBe(1);
    const rec = receiptUpdate(calls);
    expect(rec.params).toContain(100); // capped at 100 for the column CHECK
  });
});
