/**
 * receiptOcrQueue.js — BullMQ producer for receipt OCR jobs.
 *
 * Redis connection and job policy come from env (config/ocr.js); nothing is
 * hardcoded. The Queue is created lazily so importing this module (tests, syntax
 * check) does not open a Redis connection.
 */

import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { getOcrConfig, getRedisConnection } from '../../config/ocr.js';

let connection = null;
let queue = null;

function getConnection() {
  if (!connection) connection = new IORedis(getRedisConnection());
  return connection;
}

export function getReceiptOcrQueue() {
  if (!queue) {
    const { queueName } = getOcrConfig();
    queue = new Queue(queueName, { connection: getConnection() });
  }
  return queue;
}

/**
 * Enqueue an OCR job for a receipt.
 * @param {string} receiptVerificationId
 * @returns {Promise<import('bullmq').Job>}
 */
export async function enqueueReceiptOcr(receiptVerificationId) {
  if (!receiptVerificationId) throw new Error('enqueueReceiptOcr requires receiptVerificationId.');
  const { jobAttempts, jobBackoffMs } = getOcrConfig();
  return getReceiptOcrQueue().add(
    'receipt-ocr',
    { receiptVerificationId },
    {
      attempts: jobAttempts,
      backoff: { type: 'exponential', delay: jobBackoffMs },
      removeOnComplete: true,
      removeOnFail: false,
    },
  );
}

export async function closeReceiptOcrQueue() {
  if (queue) { await queue.close(); queue = null; }
  if (connection) { await connection.quit(); connection = null; }
}