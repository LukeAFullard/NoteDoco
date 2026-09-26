/**
 * Small per-device preferences in localStorage. All keys are prefixed because every
 * GitHub Pages site of an account shares one origin (and one localStorage).
 */
const PREFIX = 'notedoco:';

export function readPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writePref(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the preference lasts for this session only */
  }
}
