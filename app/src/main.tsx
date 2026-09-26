import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './app/App';
import { openStorage } from './data/health';
import { applyTheme, useTheme } from './app/theme';

applyTheme(useTheme.getState().theme);
void openStorage();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
