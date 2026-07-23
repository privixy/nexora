// Import polyfills first to make Buffer available globally
import './polyfills';

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';
import './config';
import { DatabaseProvider } from '../features/connections';
import { SettingsProvider, ThemeProvider, UpdateProvider } from '../features/settings';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <UpdateProvider>
      <ThemeProvider>
        <SettingsProvider>
          <DatabaseProvider>
            <App />
          </DatabaseProvider>
        </SettingsProvider>
      </ThemeProvider>
    </UpdateProvider>
  </React.StrictMode>,
);
