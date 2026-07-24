import { createContext } from "react";
import type * as MonacoTypes from "monaco-editor";
import type { Theme } from "../types/theme";

export type MonacoThemeLoader = (
  theme: Theme,
  monaco: typeof MonacoTypes,
) => void;

export const noopMonacoThemeLoader: MonacoThemeLoader = () => {};
export const EditorThemeContext = createContext<Theme | null>(null);
export const MonacoThemeLoaderContext = createContext<MonacoThemeLoader | null>(null);
