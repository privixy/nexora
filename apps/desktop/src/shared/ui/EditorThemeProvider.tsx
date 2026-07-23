import type { ReactNode } from "react";
import type { Theme } from "../types/theme";
import { EditorThemeContext } from "./EditorThemeContext";

interface EditorThemeProviderProps {
  children: ReactNode;
  theme: Theme;
}

export function EditorThemeProvider({ children, theme }: EditorThemeProviderProps) {
  return (
    <EditorThemeContext.Provider value={theme}>
      {children}
    </EditorThemeContext.Provider>
  );
}
