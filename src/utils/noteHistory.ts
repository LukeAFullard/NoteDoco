export const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Decides whether enough time has passed since the last checkpoint to save a new one.
 * Pass explicit `now`/`intervalMs` in tests — do not rely on wall-clock time in tests.
 */
export const shouldCreateSnapshot = (
  lastSnapshotAt: string | null,
  now: Date = new Date(),
  intervalMs: number = SNAPSHOT_INTERVAL_MS
): boolean => {
  if (!lastSnapshotAt) return true;
  return now.getTime() - new Date(lastSnapshotAt).getTime() >= intervalMs;
};
