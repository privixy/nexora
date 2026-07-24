import { useContext } from 'react';
import { SavedQueriesContext } from '../state/SavedQueriesContext';

export const useSavedQueries = () => {
  const context = useContext(SavedQueriesContext);
  if (context === undefined) {
    throw new Error('useSavedQueries must be used within a SavedQueriesProvider');
  }
  return context;
};
