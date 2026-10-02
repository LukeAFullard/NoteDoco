import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './app/App';
import { openStorage, watchStorageErrors } from './data/health';
import { purgeTrash } from './data/repos/items';
import { applyTheme, useTheme } from './app/theme';
import { applyPrefs } from './app/prefs';
import { showToast } from './design/toast';

applyTheme(useTheme.getState().theme);
applyPrefs();
watchStorageErrors();

void openStorage().then(async (s) => {
  if (s.status !== 'ok') return;
  // Quietly clear out anything trashed more than 30 days ago.
  void purgeTrash();
  // Bring over notes from NoteDoco v1 (only adds; v1's own data is never changed). It runs on
  // every start, so notes are brought over even on a device that last used v1 long ago.
  const { migrateFromV1 } = await import('./migration/v1');
  const r = await migrateFromV1();
  if (r.notes || r.groups) {
    const what = [r.notes && `${r.notes} note${r.notes === 1 ? '' : 's'}`, r.groups && `${r.groups} group${r.groups === 1 ? '' : 's'}`].filter(Boolean).join(' and ');
    showToast({ message: `Welcome to the new NoteDoco. Your ${what} came over from the previous version.` }, 10_000);
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
