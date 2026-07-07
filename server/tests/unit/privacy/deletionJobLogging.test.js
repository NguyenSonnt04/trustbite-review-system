import { describe, expect, it } from 'vitest';

import { summarizeDeletionJobResult } from '../../../src/services/deletionJobLogging.js';

describe('deletion job logging', () => {
  it('keeps operational output to aggregate counters', () => {
    const summary = summarizeDeletionJobResult({
      processed: 2,
      completed: 1,
      skipped: 0,
      failed: 1,
      results: [
        {
          requestId: 'request-123',
          userId: 'user-456',
          status: 'FAILED',
          reason: 'external_cleanup_failed',
        },
      ],
    });

    expect(summary).toEqual({
      processed: 2,
      completed: 1,
      skipped: 0,
      failed: 1,
    });
    expect(JSON.stringify(summary)).not.toContain('request-123');
    expect(JSON.stringify(summary)).not.toContain('user-456');
  });
});
