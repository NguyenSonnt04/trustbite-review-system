export function summarizeDeletionJobResult(result) {
  return {
    processed: result.processed,
    completed: result.completed,
    skipped: result.skipped,
    failed: result.failed,
  };
}
