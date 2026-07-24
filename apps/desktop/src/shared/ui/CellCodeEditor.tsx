import { useContext, useEffect, useRef } from "react";
import MonacoEditor, {
  type BeforeMount,
  type OnValidate,
} from "@monaco-editor/react";
import type * as MonacoTypes from "monaco-editor";
import { MonacoThemeLoaderContext, noopMonacoThemeLoader } from "./EditorThemeContext";
import { useInjectedEditorTheme } from "./useInjectedEditorTheme";

interface CellCodeEditorProps {
  value: string;
  onChange: (text: string) => void;
  onValidate?: (markers: MonacoTypes.editor.IMarker[]) => void;
  height?: string | number;
  readOnly?: boolean;
  language?: "json" | "plaintext";
}

export const CellCodeEditor = ({
  value,
  onChange,
  onValidate,
  height = "100%",
  readOnly = false,
  language = "json",
}: CellCodeEditorProps) => {
  const editorTheme = useInjectedEditorTheme();
  const loadMonacoTheme = useContext(MonacoThemeLoaderContext) ?? noopMonacoThemeLoader;
  const monacoRef = useRef<typeof MonacoTypes | null>(null);

  useEffect(() => {
    if (monacoRef.current) {
      loadMonacoTheme(editorTheme, monacoRef.current);
    }
  }, [editorTheme, loadMonacoTheme]);

  const handleBeforeMount: BeforeMount = (monaco) => {
    monacoRef.current = monaco;
    loadMonacoTheme(editorTheme, monaco);
  };

  const handleChange = (next: string | undefined) => {
    onChange(next ?? "");
  };

  const handleValidate: OnValidate = (markers) => {
    onValidate?.(markers);
  };

  return (
    <MonacoEditor
      height={height}
      language={language}
      theme={editorTheme.id}
      value={value}
      beforeMount={handleBeforeMount}
      onChange={handleChange}
      onValidate={handleValidate}
      options={{
        readOnly,
        minimap: { enabled: false },
        lineNumbers: "on",
        automaticLayout: true,
        formatOnPaste: language === "json",
        scrollBeyondLastLine: false,
        wordWrap: "on",
        wrappingIndent: "indent",
      }}
    />
  );
};
