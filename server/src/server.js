import 'dotenv/config';
import app from './app.js';
import appConfig from './config/app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { createReceiptOcrWorker } from './services/queue/receiptOcrWorker.js';
import { closeReceiptOcrQueue } from './services/queue/receiptOcrQueue.js';

const PORT = appConfig.port;

let ocrWorker = null;

const startOcrWorker = () => {
  // Worker is started here (never at import) so tests/syntax-check do not open
  // Redis connections. Disable via OCR_WORKER_ENABLED=false.
  if (process.env.OCR_WORKER_ENABLED === 'false') {
    console.log('[Server] Receipt OCR worker disabled by config');
    return;
  }
  try {
    ocrWorker = createReceiptOcrWorker();
    ocrWorker.on('failed', (job, err) => {
      console.error(`[OCR] job ${job?.id} failed: ${err?.message}`);
    });
    ocrWorker.on('error', (err) => {
      console.error('[OCR] worker error:', err?.message ?? err);
    });
    console.log('[Server] Receipt OCR worker started');
  } catch (err) {
    console.error('[Server] Failed to start OCR worker:', err.message);
    throw err;
  }
};

const start = async () => {
  try {
    await connectDB();
    startOcrWorker();

    app.listen(PORT, () => {
      console.log(`[Server] Running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('[Server] Failed to start:', err.message);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async (signal) => {
  console.log(`\n[Server] ${signal} received — shutting down`);
  if (ocrWorker) await ocrWorker.close().catch(() => {});
  await closeReceiptOcrQueue().catch(() => {});
  await disconnectDB();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();
