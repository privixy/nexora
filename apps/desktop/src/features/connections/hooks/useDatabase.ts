import { useContext } from 'react';
import { DatabaseContext } from '../state/DatabaseContext';

export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
};
