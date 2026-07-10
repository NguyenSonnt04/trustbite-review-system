import 'dotenv/config';
import { disconnectDB } from '../src/config/db.js';
import { runDataRetention } from '../src/services/dataRetentionService.js';

// Scheduled data-retention runner (Data_Retention_Policy.md, decision 0021).
// Intended to be invoked by a scheduler (cron / ECS scheduled task). Prints a
// JSON summary of affected rows for log ingestion.
try {
  const result = await runDataRetention();
  console.log(JSON.stringify(result));
} finally {
  await disconnectDB();
}
