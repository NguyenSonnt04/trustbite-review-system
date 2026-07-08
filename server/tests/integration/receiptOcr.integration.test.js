import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { query, deleteByIds, closeDbPool } from '../helpers/db.js';
import { createUser, createRestaurant, createReview, createReceiptVerification } from '../helpers/factories/index.js';
import { pool } from '../../src/config/db.js';
import { mockOcrProvider, registerMockReceipt, clearMockReceipts } from '../../src/services/providers/__mocks__/mockOcrProvider.js';
import { processReceiptOcr } from '../../src/services/ocrService.js';

const VENUE_LAT = 10.7769;
const VENUE_LNG = 106.7009;

const created = { users: [], restaurants: [], reviews: [], receipts: [], flags: [] };

function struct(overrides = {}) {
  return {
    rawText: 'receipt text',
    restaurantName: 'Highlands Coffee',
    receiptTime: new Date('2026-06-12T08:00:00.000Z'),
    invoiceNo: 'INV-OCR-1',
    totalAmount: 120000,
    lineItems: [{ name: 'Cafe Sua', quantity: 2, unitPrice: 30000, totalPrice: 60000 }],
    ...overrides,
  };
}

async function seedReceipt({ restaurantName = 'Highlands Coffee', fileHash, fileUrl, withGps = true, gpsAccuracyMeters = 20 } = {}) {
  const user = await createUser();
  const restaurant = await createRestaurant({
    name: restaurantName,
    latitude: VENUE_LAT,
    longitude: VENUE_LNG,
  });
  const review = await createReview({
    userId: user.id,
    restaurantId: restaurant.id,
    status: 'SUBMITTED',
    verificationStatus: 'PROCESSING',
    trustLabel: 'PROCESSING',
    publicVisibility: 'PRIVATE_UNTIL_DECISION',
    trustWeightBucket: 'NONE',
  });
  const receipt = await createReceiptVerification({
    reviewId: review.id,
    userId: user.id,
    restaurantId: restaurant.id,
    fileHashSha256: fileHash,
    fileUrl,
  });
  // Set GPS on the receipt at the venue (clean signal) unless asked otherwise.
  if (withGps) {
    await query(
      `UPDATE receipt_verifications SET gps_latitude=$2, gps_longitude=$3, gps_accuracy_meters=$4 WHERE id=$1`,
      [receipt.id, VENUE_LAT, VENUE_LNG, gpsAccuracyMeters],
    );
  }
  created.users.push(user.id);
  created.restaurants.push(restaurant.id);
  created.reviews.push(review.id);
  created.receipts.push(receipt.id);
  return { user, restaurant, review, receipt };
}

async function receiptRow(id) {
  const r = await query(`SELECT * FROM receipt_verifications WHERE id=$1`, [id]);
  return r.rows[0];
}
async function reviewRow(id) {
  const r = await query(`SELECT * FROM reviews WHERE id=$1`, [id]);
  return r.rows[0];
}

beforeEach(() => {
  clearMockReceipts();
});

afterEach(async () => {
  // Remove fraud flags created during the test (and their entity links cascade).
  await query(
    `DELETE FROM fraud_flags ff
     WHERE EXISTS (
       SELECT 1 FROM fraud_flag_entities fe
       WHERE fe.fraud_flag_id = ff.id AND fe.entity_id = ANY($1::uuid[])
     )`,
    [[...created.receipts, ...created.reviews, ...created.users]],
  );
  await query(`DELETE FROM audit_logs WHERE entity_id = ANY($1::uuid[])`, [created.receipts]);
  await deleteByIds('receipt_verifications', 'id', created.receipts);
  await deleteByIds('reviews', 'id', created.reviews);
  await deleteByIds('restaurants', 'id', created.restaurants);
  await deleteByIds('users', 'id', created.users);
  created.users = []; created.restaurants = []; created.reviews = []; created.receipts = [];
});

afterAll(async () => {
  await closeDbPool();
});

const NOW = new Date('2026-06-12T10:00:00.000Z');

describe('processReceiptOcr — pipeline + downstream decision (mock provider)', () => {
  it('merchant match 80-100% → OCR_SUCCESS then VERIFIED', async () => {
    const { receipt, review } = await seedReceipt();
    registerMockReceipt(receipt.file_url, { struct: struct() });

    await processReceiptOcr(receipt.id, { provider: mockOcrProvider, now: NOW });

    const rec = await receiptRow(receipt.id);
    const rev = await reviewRow(review.id);
    expect(rec.status).toBe('VERIFIED');
    expect(rec.ocr_restaurant_name).toBe('Highlands Coffee');
    expect(rec.decision).toBe('VERIFIED');
    expect(rev.status).toBe('VERIFIED');
    expect(rev.trust_weight_bucket).toBe('HIGH');
  });

  it('merchant 60-79% match (+25) stays within VERIFIED', async () => {
    const { receipt, review } = await seedReceipt();
    // "Highland Cafe" vs "Highlands Coffee" ~ 75% → +25 → score 25 → VERIFIED.
    registerMockReceipt(receipt.file_url, { struct: struct({ restaurantName: 'Highland Cafe' }) });

    await processReceiptOcr(receipt.id, { provider: mockOcrProvider, now: NOW });

    const rec = await receiptRow(receipt.id);
    expect(rec.status).toBe('VERIFIED');
    expect((await reviewRow(review.id)).status).toBe('VERIFIED');
  });

  it('merchant unreadable (null vendor, +50) → PENDING_ADMIN_REVIEW', async () => {
    const { receipt, review } = await seedReceipt();
    registerMockReceipt(receipt.file_url, { struct: struct({ restaurantName: null }) });

    await processReceiptOcr(receipt.id, { provider: mockOcrProvider, now: NOW });

    const rec = await receiptRow(receipt.id);
    expect(rec.ocr_restaurant_name).toBeNull();
    expect(rec.status).toBe('PENDING_ADMIN_REVIEW');
    expect((await reviewRow(review.id)).status).toBe('PENDING_ADMIN_REVIEW');
  });

  it('merchant <60% (+60) with low GPS accuracy (+15) → REFERENCE_ONLY band', async () => {
    const { receipt, review } = await seedReceipt({ gpsAccuracyMeters: 150 });
    // "Coffee Shop XYZ" vs "Highlands Coffee" <60% → +60; accuracy>100 → +15; total 75.
    registerMockReceipt(receipt.file_url, { struct: struct({ restaurantName: 'Coffee Shop XYZ' }) });

    await processReceiptOcr(receipt.id, { provider: mockOcrProvider, now: NOW });

    const rec = await receiptRow(receipt.id);
    expect(rec.status).toBe('REFERENCE_ONLY');
    expect((await reviewRow(review.id)).status).toBe('REFERENCE_ONLY');
  });

  it('persists line items to receipt_line_items', async () => {
    const { receipt } = await seedReceipt();
    registerMockReceipt(receipt.file_url, { struct: struct() });

    await processReceiptOcr(receipt.id, { provider: mockOcrProvider, now: NOW });

    const items = await query(`SELECT * FROM receipt_line_items WHERE receipt_verification_id=$1`, [receipt.id]);
    expect(items.rows).toHaveLength(1);
    expect(items.rows[0].raw_item_name).toBe('Cafe Sua');
    expect(Number(items.rows[0].quantity)).toBe(2);
  });

  it('receipt 49-168h old (+40) → PENDING band', async () => {
    const { receipt } = await seedReceipt();
    // 100h before NOW
    registerMockReceipt(receipt.file_url, { struct: struct({ receiptTime: new Date('2026-06-08T06:00:00.000Z') }) });

    await processReceiptOcr(receipt.id, { provider: mockOcrProvider, now: NOW });

    const rec = await receiptRow(receipt.id);
    expect(rec.status).toBe('PENDING_ADMIN_REVIEW');
  });

  it('duplicate file hash → DUPLICATE rejected + DUPLICATE_RECEIPT_HASH flag, no OCR', async () => {
    const sharedContent = 'identical-receipt-bytes';
    // First receipt: process it so its stored hash = sha256(sharedContent), ends VERIFIED.
    const first = await seedReceipt();
    registerMockReceipt(first.receipt.file_url, { fileContent: sharedContent, struct: struct() });
    await processReceiptOcr(first.receipt.id, { provider: mockOcrProvider, now: NOW });
    expect((await receiptRow(first.receipt.id)).status).toBe('VERIFIED');

    // Second receipt with the SAME file content → same computed hash.
    const second = await seedReceipt();
    let analyzed = false;
    const spyProvider = {
      async loadFile() { return Buffer.from(sharedContent, 'utf8'); },
      async analyzeExpense() { analyzed = true; return struct(); },
    };

    await processReceiptOcr(second.receipt.id, { provider: spyProvider, now: NOW });

    const rec = await receiptRow(second.receipt.id);
    const rev = await reviewRow(second.review.id);
    expect(analyzed).toBe(false); // OCR never ran
    expect(rec.status).toBe('REJECTED');
    expect(rev.verification_status).toBe('DUPLICATE_REJECTED');

    const flag = await query(
      `SELECT ff.flag_code FROM fraud_flags ff
       JOIN fraud_flag_entities fe ON fe.fraud_flag_id = ff.id
       WHERE fe.entity_id=$1 AND fe.entity_type='RECEIPT_VERIFICATION'`,
      [second.receipt.id],
    );
    expect(flag.rows.map((r) => r.flag_code)).toContain('DUPLICATE_RECEIPT_HASH');
  });

    it('bad file format → OCR_FAILED before scoring, no downstream decision', async () => {
      const { receipt, review } = await seedReceipt({ fileUrl: 's3://trustbite-invoices/receipts/bad.exe' });
      registerMockReceipt(receipt.file_url, { struct: struct() });

      await processReceiptOcr(receipt.id, { provider: mockOcrProvider, now: NOW });

    const rec = await receiptRow(receipt.id);
    const rev = await reviewRow(review.id);
    expect(rec.status).toBe('OCR_FAILED');
    expect(rec.decision).toBeNull();
      // review left in its pre-OCR processing state (not decided)
      expect(rev.status).toBe('SUBMITTED');
    });

    it('oversized loaded file → OCR_FAILED before analyzeExpense or downstream decision', async () => {
      const previousMax = process.env.OCR_MAX_FILE_BYTES;
      process.env.OCR_MAX_FILE_BYTES = '10';
      const { receipt, review } = await seedReceipt();
      let analyzed = false;
      const provider = {
        async loadFile() { return Buffer.from('01234567890', 'utf8'); },
        async analyzeExpense() { analyzed = true; return struct(); },
      };

      try {
        await processReceiptOcr(receipt.id, { provider, now: NOW });
      } finally {
        if (previousMax == null) delete process.env.OCR_MAX_FILE_BYTES;
        else process.env.OCR_MAX_FILE_BYTES = previousMax;
      }

      const rec = await receiptRow(receipt.id);
      const rev = await reviewRow(review.id);
      expect(analyzed).toBe(false);
      expect(rec.status).toBe('OCR_FAILED');
      expect(rec.decision).toBeNull();
      expect(rev.status).toBe('SUBMITTED');
    });

    it('OCR_SUCCESS retry resumes at verification without reloading or re-running OCR', async () => {
      const { receipt, review } = await seedReceipt();
      await query(
        `UPDATE receipt_verifications
         SET status='OCR_SUCCESS',
           ocr_text=$2,
           ocr_restaurant_name=$3,
           ocr_receipt_time=$4,
           ocr_invoice_no=$5,
           ocr_total_amount=$6
       WHERE id=$1`,
      [
        receipt.id,
        'previously extracted receipt text',
        'Highlands Coffee',
        new Date('2026-06-12T08:00:00.000Z'),
        'INV-RESUME-1',
        120000,
      ],
    );
    const provider = {
      async loadFile() { throw new Error('file should not be loaded again'); },
      async analyzeExpense() { throw new Error('OCR should not run again'); },
    };

    const result = await processReceiptOcr(receipt.id, { provider, now: NOW });

    const rec = await receiptRow(receipt.id);
    const rev = await reviewRow(review.id);
    expect(result).toMatchObject({ status: 'OCR_SUCCESS', resumed: true });
    expect(rec.status).toBe('VERIFIED');
    expect(rec.ocr_restaurant_name).toBe('Highlands Coffee');
      expect(rev.status).toBe('VERIFIED');
      expect(rev.trust_weight_bucket).toBe('HIGH');
    });

    it('orphaned load continuation resumes OCR_SUCCESS instead of re-entering hash-check', async () => {
      const { receipt, review } = await seedReceipt();
      let analyzed = false;
      const provider = {
        async loadFile() {
          await query(
            `UPDATE receipt_verifications
             SET status='OCR_SUCCESS',
                 ocr_text=$2,
                 ocr_restaurant_name=$3,
                 ocr_receipt_time=$4,
                 ocr_invoice_no=$5,
                 ocr_total_amount=$6
             WHERE id=$1`,
            [
              receipt.id,
              'already extracted receipt text',
              'Highlands Coffee',
              new Date('2026-06-12T08:00:00.000Z'),
              'INV-ORPHAN-RESUME',
              120000,
            ],
          );
          return Buffer.from('stale-orphaned-load-bytes', 'utf8');
        },
        async analyzeExpense() {
          analyzed = true;
          return struct({ invoiceNo: 'SHOULD-NOT-RUN' });
        },
      };

      const result = await processReceiptOcr(receipt.id, { provider, now: NOW });

      const rec = await receiptRow(receipt.id);
      const rev = await reviewRow(review.id);
      expect(result).toMatchObject({ status: 'OCR_SUCCESS', resumed: true });
      expect(analyzed).toBe(false);
      expect(rec.status).toBe('VERIFIED');
      expect(rec.ocr_invoice_no).toBe('INV-ORPHAN-RESUME');
      expect(rev.status).toBe('VERIFIED');
      });

      it('orphaned OCR continuation must not overwrite a terminal status before persist', async () => {
        const { receipt, review } = await seedReceipt();
        let terminalRaceInjected = false;
        let releaseTerminalRace = Promise.resolve();
        const provider = {
          async loadFile() {
            return Buffer.from('terminal-race-after-ocr-bytes', 'utf8');
          },
          async analyzeExpense() {
            const raceClient = await pool.connect();
            await raceClient.query('BEGIN');
            await raceClient.query(
              `UPDATE receipt_verifications SET status='PENDING_ADMIN_REVIEW' WHERE id=$1`,
              [receipt.id],
            );
            terminalRaceInjected = true;
            releaseTerminalRace = new Promise((resolve, reject) => {
              setTimeout(async () => {
                try {
                  await raceClient.query('COMMIT');
                  resolve();
                } catch (err) {
                  reject(err);
                } finally {
                  raceClient.release();
                }
              }, 50);
            });
            return struct({ invoiceNo: 'SHOULD-NOT-PERSIST' });
          },
        };

        try {
          const result = await processReceiptOcr(receipt.id, { provider, now: NOW });
          await releaseTerminalRace;
          const rec = await receiptRow(receipt.id);
          const rev = await reviewRow(review.id);

          expect(terminalRaceInjected).toBe(true);
          expect(result).toMatchObject({ status: 'PENDING_ADMIN_REVIEW', skipped: true });
          expect(rec.status).toBe('PENDING_ADMIN_REVIEW');
          expect(rec.ocr_invoice_no).toBeNull();
          expect(rev.status).toBe('SUBMITTED');
        } finally {
          await releaseTerminalRace.catch(() => {});
        }
      });

      it('records an audit row for a successful OCR + decision', async () => {
        const { receipt } = await seedReceipt();
      registerMockReceipt(receipt.file_url, { struct: struct() });

    await processReceiptOcr(receipt.id, { provider: mockOcrProvider, now: NOW });

    const audit = await query(`SELECT count(*)::int AS n FROM audit_logs WHERE entity_id=$1`, [receipt.id]);
    expect(audit.rows[0].n).toBeGreaterThanOrEqual(1);
  });
});
