import type { ReactNode } from "react";
import { EditorThemeProvider } from "../../../shared/ui/EditorThemeProvider";
import { useEditorTheme } from "../hooks/useEditorTheme";

export function SettingsEditorThemeProvider({ children }: { children: ReactNode }) {
  const theme = useEditorTheme();
  return <EditorThemeProvider theme={theme}>{children}</EditorThemeProvider>;
}
