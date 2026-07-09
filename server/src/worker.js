import 'dotenv/config';
import { connectDB, disconnectDB } from './config/db.js';
import { createReceiptOcrWorker } from './services/queue/receiptOcrWorker.js';
import { closeReceiptOcrQueue } from './services/queue/receiptOcrQueue.js';

let ocrWorker = null;

const start = async () => {
  try {
    await connectDB();
    ocrWorker = createReceiptOcrWorker();
    ocrWorker.on('failed', (job, err) => {
      console.error(`[OCR] job ${job?.id} failed: ${err?.message}`);
    });
    ocrWorker.on('error', (err) => {
      console.error('[OCR] worker error:', err?.message ?? err);
    });
    console.log('[Worker] Receipt OCR worker started');
  } catch (err) {
    console.error('[Worker] Failed to start:', err.message);
    process.exit(1);
  }
};

const shutdown = async (signal) => {
  console.log(`\n[Worker] ${signal} received - shutting down`);
  if (ocrWorker) await ocrWorker.close().catch(() => {});
  await closeReceiptOcrQueue().catch(() => {});
  await disconnectDB();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();
