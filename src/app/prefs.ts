import { create } from 'zustand';
import { readPref, writePref } from '@/lib/localPref';

/** Per-device display preferences (Settings → Appearance). */
export interface Prefs {
  textSize: 'small' | 'medium' | 'large';
  density: 'comfortable' | 'compact';
  stickyFont: 'sans' | 'hand' | 'serif';
  tidyStickies: boolean;
  weekStart: 'auto' | 'monday' | 'sunday';
}

const DEFAULTS: Prefs = { textSize: 'medium', density: 'comfortable', stickyFont: 'sans', tidyStickies: false, weekStart: 'auto' };

export const usePrefs = create<Prefs>(() => ({ ...DEFAULTS, ...readPref<Partial<Prefs>>('prefs', {}) }));

export function setPrefs(patch: Partial<Prefs>) {
  usePrefs.setState(patch);
  writePref('prefs', usePrefs.getState());
  applyPrefs();
}

/** Applies preferences that are plain CSS (text size, sticky font) to the document. */
export function applyPrefs() {
  const p = usePrefs.getState();
  const root = document.documentElement;
  root.style.fontSize = { small: '15px', medium: '16px', large: '18px' }[p.textSize];
  root.style.setProperty(
    '--sticky-font',
    { sans: 'var(--font-sans)', hand: "'Caveat', 'Comic Neue', cursive", serif: "Georgia, 'Times New Roman', serif" }[p.stickyFont],
  );
  root.dataset.density = p.density;
}
