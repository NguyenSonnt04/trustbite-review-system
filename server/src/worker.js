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
  let shutdownFailed = false;

  const closeStep = async (label, close) => {
    try {
      await close();
    } catch (err) {
      shutdownFailed = true;
      console.error(`[Worker] ${label} failed during shutdown:`, err?.message ?? err);
    }
  };

  if (ocrWorker) await closeStep('OCR worker close', () => ocrWorker.close());
  await closeStep('OCR queue close', closeReceiptOcrQueue);
  await closeStep('database disconnect', disconnectDB);
  process.exit(shutdownFailed ? 1 : 0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();
