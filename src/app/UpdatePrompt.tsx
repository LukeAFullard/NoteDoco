import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { showToast } from '@/design/toast';

/**
 * Asks before applying an update, so a new version never reloads the page mid-edit.
 * (v1 used auto-update.)
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (!needRefresh) return;
    showToast({ message: 'A new version of NoteDoco is ready.', action: { label: 'Reload', run: () => updateServiceWorker(true) } }, 0);
  }, [needRefresh, updateServiceWorker]);

  return null;
}
