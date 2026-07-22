import { createContext } from 'react';
import type { EditorContextType } from '../contracts';

export type { EditorContextType } from '../contracts';

export const EditorContext = createContext<EditorContextType | undefined>(undefined);
