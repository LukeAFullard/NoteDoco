import { newId } from '@/lib/ids';

const KEY = 'notedoco:deviceId';
let cached: string | null = null;

/** A stable per-install id recorded on every write, so a future sync can tell devices apart. */
export function deviceId(): string {
  if (cached) return cached;
  try {
    cached = localStorage.getItem(KEY);
    if (!cached) {
      cached = newId();
      localStorage.setItem(KEY, cached);
    }
  } catch {
    cached = newId(); // storage blocked: fall back to a per-session id
  }
  return cached;
}
