import { createContext } from 'react';
import type { DatabaseContextType } from '../features/connections';

export type {
  ConnectionAppearance,
  ConnectionData,
  ConnectionGroup,
  ConnectionsFile,
  DatabaseContextType,
  DatabaseData,
  IconOverride,
  RoutineInfo,
  SavedConnection,
  SchemaData,
  TableInfo,
  TriggerInfo,
  ViewInfo,
} from '../features/connections';

export const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);
