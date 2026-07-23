import { useContext } from "react";
import { EditorThemeContext } from "./EditorThemeContext";
import type { Theme } from "../types/theme";

export function useInjectedEditorTheme(): Theme {
  const theme = useContext(EditorThemeContext);
  if (!theme) {
    throw new Error("useInjectedEditorTheme must be used within EditorThemeProvider");
  }
  return theme;
}
