import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';

/**
 * Settings that belong with the data (and travel in backups), unlike per-device display
 * preferences in localStorage (app/prefs.ts).
 */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row === undefined ? fallback : (row.value as T);
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}

export function useSetting<T>(key: string, fallback: T): T {
  return useLiveQuery(() => getSetting(key, fallback), [key], fallback);
}
