import { create } from 'zustand';

export type Theme = 'dark' | 'light' | 'system';
const KEY = 'notedoco:theme'; // read raw by public/theme-init.js before first paint

function load(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'light' || t === 'system' ? t : 'dark';
  } catch {
    return 'dark';
  }
}

const systemDark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;

export function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && systemDark());
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#10161C' : '#EEF0EC');
}

export const useTheme = create<{ theme: Theme }>(() => ({ theme: load() }));

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* session only */
  }
  useTheme.setState({ theme });
  applyTheme(theme);
}

if (typeof matchMedia === 'function') {
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (useTheme.getState().theme === 'system') applyTheme('system');
  });
}
