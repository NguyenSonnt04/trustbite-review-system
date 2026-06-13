import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { query, deleteByIds, closeDbPool } from '../helpers/db.js';
import { createUser, createRestaurant, createReview, createReceiptVerification } from '../helpers/factories/index.js';
import { mockOcrProvider, registerMockReceipt, clearMockReceipts } from '../../src/services/providers/__mocks__/mockOcrProvider.js';
import { runReceiptOcrJob, markPendingAdminReview } from '../../src/services/queue/receiptOcrWorker.js';

const created = { users: [], restaurants: [], reviews: [], receipts: [] };

async function seedReceipt() {
  const user = await createUser();
  const restaurant = await createRestaurant({ name: 'Pho 24', latitude: 10.77, longitude: 106.7 });
  const review = await createReview({
    userId: user.id,
    restaurantId: restaurant.id,
    status: 'SUBMITTED',
    verificationStatus: 'PROCESSING',
    trustLabel: 'PROCESSING',
    publicVisibility: 'PRIVATE_UNTIL_DECISION',
    trustWeightBucket: 'NONE',
  });
  const receipt = await createReceiptVerification({ reviewId: review.id, userId: user.id, restaurantId: restaurant.id });
  created.users.push(user.id); created.restaurants.push(restaurant.id);
  created.reviews.push(review.id); created.receipts.push(receipt.id);
  return { user, restaurant, review, receipt };
}

const recRow = async (id) => (await query(`SELECT * FROM receipt_verifications WHERE id=$1`, [id])).rows[0];
const revRow = async (id) => (await query(`SELECT * FROM reviews WHERE id=$1`, [id])).rows[0];
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(() => clearMockReceipts());

afterEach(async () => {
  await query(`DELETE FROM audit_logs WHERE entity_id = ANY($1::uuid[])`, [created.receipts]);
  await deleteByIds('receipt_verifications', 'id', created.receipts);
  await deleteByIds('reviews', 'id', created.reviews);
  await deleteByIds('restaurants', 'id', created.restaurants);
  await deleteByIds('users', 'id', created.users);
  created.users = []; created.restaurants = []; created.reviews = []; created.receipts = [];
});

afterAll(async () => { await closeDbPool(); });

describe('receipt OCR worker degrade behavior', () => {
  it('markPendingAdminReview parks receipt + review without a fraud flag', async () => {
    const { receipt, review } = await seedReceipt();

    await markPendingAdminReview(receipt.id, 'OCR provider unavailable after retries');

    const rec = await recRow(receipt.id);
    const rev = await revRow(review.id);
    expect(rec.status).toBe('PENDING_ADMIN_REVIEW');
    expect(rev.status).toBe('PENDING_ADMIN_REVIEW');
    expect(rev.public_visibility).toBe('PRIVATE_UNTIL_DECISION');
    expect(rev.trust_weight_bucket).toBe('NONE');

    const flags = await query(
      `SELECT 1 FROM fraud_flag_entities WHERE entity_id=$1 AND entity_type='RECEIPT_VERIFICATION'`,
      [receipt.id],
    );
    expect(flags.rows).toHaveLength(0);
  });

  it('job timeout on the final attempt degrades to PENDING_ADMIN_REVIEW and zombie OCR cannot overwrite it', async () => {
    const { receipt, review } = await seedReceipt();
    // Mock provider sleeps far past the job timeout.
    registerMockReceipt(receipt.file_url, { delayMs: 200, struct: { lineItems: [] } });

    const job = {
      data: { receiptVerificationId: receipt.id },
      attemptsMade: 2, // final attempt when attempts=3
      opts: { attempts: 3 },
    };

    await runReceiptOcrJob(job, { provider: mockOcrProvider, timeoutMs: 20 });

    expect((await recRow(receipt.id)).status).toBe('PENDING_ADMIN_REVIEW');
    expect((await revRow(review.id)).status).toBe('PENDING_ADMIN_REVIEW');

    await delay(250);

    const rec = await recRow(receipt.id);
    expect(rec.status).toBe('PENDING_ADMIN_REVIEW');
    expect(rec.decision).toBeNull();
    expect((await revRow(review.id)).status).toBe('PENDING_ADMIN_REVIEW');
  });

  it('provider error on a non-final attempt rethrows for retry (no degrade yet)', async () => {
    const { receipt } = await seedReceipt();
    registerMockReceipt(receipt.file_url, { behavior: 'error', errorMessage: 'transient' });

    const job = { data: { receiptVerificationId: receipt.id }, attemptsMade: 0, opts: { attempts: 3 } };

    await expect(runReceiptOcrJob(job, { provider: mockOcrProvider, timeoutMs: 5000 })).rejects.toThrow('transient');
    const rec = await recRow(receipt.id);
    // Still mid-pipeline; not degraded to pending on a retryable attempt.
    expect(rec.status).not.toBe('PENDING_ADMIN_REVIEW');
  });

  it('provider error on the final attempt degrades to PENDING_ADMIN_REVIEW', async () => {
    const { receipt, review } = await seedReceipt();
    registerMockReceipt(receipt.file_url, { behavior: 'error', errorMessage: 'still failing' });

    const job = { data: { receiptVerificationId: receipt.id }, attemptsMade: 2, opts: { attempts: 3 } };

    await runReceiptOcrJob(job, { provider: mockOcrProvider, timeoutMs: 5000 });

    expect((await recRow(receipt.id)).status).toBe('PENDING_ADMIN_REVIEW');
    expect((await revRow(review.id)).status).toBe('PENDING_ADMIN_REVIEW');
  });
});
