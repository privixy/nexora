import { useContext } from 'react';
import { ConnectionLayoutContext } from '../state/ConnectionLayoutContext';
import type { ConnectionLayoutState } from './useConnectionLayout';

export const useConnectionLayoutContext = (): ConnectionLayoutState => {
  const ctx = useContext(ConnectionLayoutContext);
  if (!ctx) {
    throw new Error('useConnectionLayoutContext must be used within ConnectionLayoutProvider');
  }
  return ctx;
};
