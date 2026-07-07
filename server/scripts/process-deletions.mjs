import 'dotenv/config';
import { disconnectDB } from '../src/config/db.js';
import { summarizeDeletionJobResult } from '../src/services/deletionJobLogging.js';
import { processDueAccountDeletions } from '../src/services/accountDeletionProcessor.js';

const parseBatchSize = () => {
  const index = process.argv.indexOf('--batch-size');
  if (index === -1 || index === process.argv.length - 1) {
    return undefined;
  }
  return process.argv[index + 1];
};

try {
  const result = await processDueAccountDeletions({ batchSize: parseBatchSize() });
  console.log(JSON.stringify(summarizeDeletionJobResult(result)));
} finally {
  await disconnectDB();
}
