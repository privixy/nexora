import { createContext } from 'react';
import type { DatabaseContextType } from '..';

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
} from '..';

export const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);
