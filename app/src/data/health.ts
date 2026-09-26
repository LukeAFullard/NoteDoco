import { create } from 'zustand';
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

export function describeStorageError(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  if (name === 'QuotaExceededError' || /quota/i.test(String(error))) {
    return 'Your device is out of space for NoteDoco. Free some space, then reload.';
  }
  if (name === 'InvalidStateError' || name === 'SecurityError' || name === 'MissingAPIError') {
    return 'This browser is blocking storage (often private browsing). Notes can’t be saved here.';
  }
  return 'NoteDoco can’t open its storage, so notes can’t be saved right now. Try reloading.';
}
