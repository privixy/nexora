import { createContext } from 'react';
import type { ConnectionLayoutState } from '../shared/hooks/useConnectionLayout';

export type { ConnectionLayoutState };

export const ConnectionLayoutContext = createContext<ConnectionLayoutState | undefined>(undefined);
