// Import polyfills first to make Buffer available globally
import '../polyfills';

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import '../index.css';
import '../i18n/config';
import { DatabaseProvider } from '../features/connections';
import { SettingsProvider, ThemeProvider, UpdateProvider } from '../features/settings';
import { SavedQueriesProvider } from '../features/editor/state/SavedQueriesProvider';
import { QueryHistoryProvider } from '../features/editor/state/QueryHistoryProvider';
import { EditorProvider } from '../features/editor/state/EditorProvider';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <UpdateProvider>
      <ThemeProvider>
        <SettingsProvider>
          <DatabaseProvider>
            <SavedQueriesProvider>
              <QueryHistoryProvider>
                <EditorProvider>
                  <App />
                </EditorProvider>
              </QueryHistoryProvider>
            </SavedQueriesProvider>
          </DatabaseProvider>
        </SettingsProvider>
      </ThemeProvider>
    </UpdateProvider>
  </React.StrictMode>,
);
