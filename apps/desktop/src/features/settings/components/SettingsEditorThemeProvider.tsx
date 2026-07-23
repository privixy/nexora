import type { ReactNode } from "react";
import { EditorThemeProvider } from "../../../shared/ui/EditorThemeProvider";
import { useEditorTheme } from "../hooks/useEditorTheme";
import { loadMonacoTheme } from "../themes/themeUtils";

export function SettingsEditorThemeProvider({ children }: { children: ReactNode }) {
  const theme = useEditorTheme();
  return (
    <EditorThemeProvider theme={theme} loadMonacoTheme={loadMonacoTheme}>
      {children}
    </EditorThemeProvider>
  );
}
