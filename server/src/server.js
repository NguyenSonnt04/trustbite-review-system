import 'dotenv/config';
import app from './app.js';
import appConfig from './config/app.js';
import { connectDB, disconnectDB } from './config/db.js';

const PORT = appConfig.port;

const start = async () => {
  try {
    await connectDB();

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
  await disconnectDB();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();
