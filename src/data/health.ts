import { create } from 'zustand';
import Dexie from 'dexie';
import { db } from './db';

export type StorageState =
  | { status: 'opening' }
  | { status: 'ok' }
  | { status: 'failed'; message: string };

export const useStorageHealth = create<StorageState>(() => ({ status: 'opening' }));

/**
 * Opens the database and reports the result. There is deliberately no in-memory fallback:
 * v1 silently switched to memory when IndexedDB failed, and everything written afterwards
 * vanished on reload. v2 tells the user instead (see StorageBanner).
 */
export async function openStorage(): Promise<StorageState> {
  try {
    await db.open();
    db.on('versionchange', () => {
      // Another tab is upgrading the schema: close so it can proceed, then ask for a reload.
      db.close();
      useStorageHealth.setState({
        status: 'failed',
        message: 'NoteDoco was updated in another tab. Reload this tab to keep working.',
      });
      return false;
    });
    useStorageHealth.setState({ status: 'ok' });
  } catch (error) {
    useStorageHealth.setState({ status: 'failed', message: describeStorageError(error) });
  }
  return useStorageHealth.getState();
}

/** Database errors that mean saving isn't working (as opposed to a bug in one write). */
const STORAGE_FAILURE = /QuotaExceeded|DatabaseClosed|OpenFailed|InvalidState|Abort|Unknown|MissingAPI|Version|Upgrade|Security/;

export function isStorageFailure(error: unknown): boolean {
  const e = error as { name?: string; inner?: { name?: string } } | null;
  const names = `${e?.name ?? ''} ${e?.inner?.name ?? ''}`;
  if (/QuotaExceeded/.test(names) || /quota/i.test(String(error))) return true;
  return error instanceof Dexie.DexieError && STORAGE_FAILURE.test(names);
}

/**
 * A save failed after storage opened (the device filled up, or the browser closed the
 * database). Shows the storage banner, so it's never silent (decision 0003).
 */
export function reportStorageError(error: unknown) {
  if (!isStorageFailure(error) || useStorageHealth.getState().status === 'failed') return;
  const full = /QuotaExceeded|quota/i.test(`${(error as { name?: string })?.name} ${(error as { inner?: { name?: string } })?.inner?.name} ${String(error)}`);
  const message = full
    ? 'Your device is out of space, so your latest changes couldn’t be saved. Free some space and keep this tab open: the next change tries again. Copy anything important before reloading.'
    : 'Your latest changes couldn’t be saved: the browser closed NoteDoco’s storage. Copy anything important, then reload.';
  useStorageHealth.setState({ status: 'failed', message });
}

/** Catches failed saves that nothing else handled (most saves are fire-and-forget). */
export function watchStorageErrors() {
  window.addEventListener('unhandledrejection', (e) => reportStorageError(e.reason));
}

export function describeStorageError(error: unknown): string {
  const inner = (error as { inner?: unknown } | null)?.inner;
  if (inner && !(error instanceof Error && /QuotaExceeded/.test(error.name))) return describeStorageError(inner);
  const name = error instanceof Error ? error.name : '';
  if (name === 'QuotaExceededError' || /quota/i.test(String(error))) {
    return 'Your device is out of space for NoteDoco. Free some space, then reload.';
  }
  if (name === 'InvalidStateError' || name === 'SecurityError' || name === 'MissingAPIError') {
    return 'This browser is blocking storage (often private browsing). Notes can’t be saved here.';
  }
  return 'NoteDoco can’t open its storage, so notes can’t be saved right now. Try reloading.';
}
