import { createContext } from 'react';
import type { EditorContextType } from '../features/editor';

export type { EditorContextType } from '../features/editor';

export const EditorContext = createContext<EditorContextType | undefined>(undefined);
