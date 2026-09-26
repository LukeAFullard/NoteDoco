import { useEffect } from 'react';
import { openPalette } from './ui';
import { redoWithToast, undoWithToast } from './undoActions';

export function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
}

/** App-wide keyboard shortcuts. Editors handle their own undo while focused. */
export function useGlobalShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openPalette();
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        void (e.shiftKey ? redoWithToast() : undoWithToast());
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        void redoWithToast();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
