import 'dotenv/config';
import { disconnectDB } from '../src/config/db.js';
import { runDataRetention } from '../src/services/dataRetentionService.js';

// Scheduled data-retention runner (Data_Retention_Policy.md, decision 0021).
// Intended to be invoked by a scheduler (cron / ECS scheduled task). Prints a
// JSON summary of affected rows for log ingestion.
try {
  const result = await runDataRetention();
  console.log(JSON.stringify(result));
  // Per-action failures are collected (not thrown) so every job still runs;
  // surface them to the scheduler via a non-zero exit code.
  if (result.errors) {
    process.exitCode = 1;
  }
} catch (err) {
  // Emit the failure in the same JSON shape as the success path so log ingestion
  // stays uniform, and signal failure to the scheduler.
  console.error(JSON.stringify({ error: err?.message ?? String(err) }));
  process.exitCode = 1;
} finally {
  try {
    await disconnectDB();
  } catch (disconnectErr) {
    // Do not let a disconnect failure mask the original run error above.
    console.error(JSON.stringify({ error: `disconnect failed: ${disconnectErr?.message ?? String(disconnectErr)}` }));
    process.exitCode = 1;
  }
}
