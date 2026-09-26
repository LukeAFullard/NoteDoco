import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './app/App';
import { openStorage } from './data/health';
import { purgeTrash } from './data/repos/items';
import { applyTheme, useTheme } from './app/theme';

applyTheme(useTheme.getState().theme);
// Open storage, then quietly clear out anything trashed more than 30 days ago.
void openStorage().then((s) => {
  if (s.status === 'ok') void purgeTrash();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
