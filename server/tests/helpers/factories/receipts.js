import { query } from '../db.js';

let receiptSequence = 0;

export async function createReceiptVerification({ reviewId, userId, restaurantId, ...overrides } = {}) {
  if (!reviewId) throw new Error('createReceiptVerification requires reviewId.');
  if (!userId) throw new Error('createReceiptVerification requires userId.');
  if (!restaurantId) throw new Error('createReceiptVerification requires restaurantId.');

  receiptSequence += 1;

  const result = await query(
    `
    INSERT INTO receipt_verifications (
      review_id, user_id, restaurant_id, branch_id,
      file_url, file_hash_sha256, status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
    `,
    [
      reviewId,
      userId,
      restaurantId,
      overrides.branchId ?? null,
      overrides.fileUrl ?? `s3://trustbite-invoices/receipts/test-${receiptSequence}.jpg`,
      overrides.fileHashSha256 ?? `${receiptSequence}`.padStart(64, '0'),
      overrides.status ?? 'UPLOADED',
    ],
  );

  return result.rows[0];
}
