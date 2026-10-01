import { readPref, writePref } from '@/lib/localPref';

export interface StorageStatus {
  supported: boolean;
  persisted: boolean | null;
  usage: number | null;
  quota: number | null;
}

export async function getStorageStatus(): Promise<StorageStatus> {
  const s = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!s?.estimate) return { supported: false, persisted: null, usage: null, quota: null };
  const [persisted, est] = await Promise.all([s.persisted?.() ?? Promise.resolve(null), s.estimate()]);
  return { supported: true, persisted, usage: est.usage ?? null, quota: est.quota ?? null };
}

export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

/**
 * Asks once, after the user has made something worth keeping (not on first load, when
 * browsers are most likely to refuse and users most likely to be puzzled).
 */
export async function maybeRequestPersistence(): Promise<void> {
  if (readPref('persistAsked', false)) return;
  writePref('persistAsked', true);
  if (await navigator.storage?.persisted?.()) return;
  await requestPersistence();
}

/**
 * iPhone/iPad browser, not installed to the Home Screen: data can be deleted after 7 days
 * unused. Every iOS browser runs on WebKit and can add to the Home Screen (iOS 16.4+).
 */
export function needsHomeScreenInstall(nav: Navigator = navigator, standalone = matchesStandalone()): boolean {
  const ua = nav.userAgent;
  const iOS = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1);
  const installed = standalone || (nav as Navigator & { standalone?: boolean }).standalone === true;
  return iOS && !installed;
}

function matchesStandalone(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches;
}

export function formatBytes(n: number | null): string {
  if (n === null) return '–';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}
