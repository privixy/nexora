import type { ReactNode } from "react";
import type { Theme } from "../types/theme";
import {
  EditorThemeContext,
  MonacoThemeLoaderContext,
  noopMonacoThemeLoader,
  type MonacoThemeLoader,
} from "./EditorThemeContext";

export interface EditorThemeProviderProps {
  children: ReactNode;
  theme: Theme;
  loadMonacoTheme?: MonacoThemeLoader;
}

export function EditorThemeProvider({
  children,
  theme,
  loadMonacoTheme = noopMonacoThemeLoader,
}: EditorThemeProviderProps) {
  return (
    <EditorThemeContext.Provider value={theme}>
      <MonacoThemeLoaderContext.Provider value={loadMonacoTheme}>
        {children}
      </MonacoThemeLoaderContext.Provider>
    </EditorThemeContext.Provider>
  );
}
