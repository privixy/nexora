import { useEffect, useRef } from "react";
import { DiffEditor, type DiffOnMount } from "@monaco-editor/react";
import type * as MonacoTypes from "monaco-editor";
import { loadMonacoTheme } from "../../themes/themeUtils";
import { useInjectedEditorTheme } from "./useInjectedEditorTheme";

interface CellDiffEditorProps {
  original: string;
  modified: string;
  onChange?: (next: string) => void;
  height?: string | number;
  readOnly?: boolean;
  renderSideBySide?: boolean;
  language?: "json" | "plaintext";
}

export const CellDiffEditor = ({
  original,
  modified,
  onChange,
  height = "100%",
  readOnly = false,
  renderSideBySide = false,
  language = "json",
}: CellDiffEditorProps) => {
  const editorTheme = useInjectedEditorTheme();
  const monacoRef = useRef<typeof MonacoTypes | null>(null);
  const editorRef = useRef<MonacoTypes.editor.IStandaloneDiffEditor | null>(
    null,
  );

  useEffect(() => {
    if (monacoRef.current) {
      loadMonacoTheme(editorTheme, monacoRef.current);
    }
  }, [editorTheme]);

  const handleMount: DiffOnMount = (editor, monaco) => {
    monacoRef.current = monaco;
    editorRef.current = editor;
    loadMonacoTheme(editorTheme, monaco);

    editor.getOriginalEditor().updateOptions({ readOnly: true });
    editor.getModifiedEditor().updateOptions({ readOnly });
    if (onChange) {
      editor.getModifiedEditor().onDidChangeModelContent(() => {
        onChange(editor.getModifiedEditor().getValue());
      });
    }
  };

  return (
    <DiffEditor
      key={renderSideBySide ? "sbs" : "inline"}
      height={height}
      language={language}
      theme={editorTheme.id}
      original={original}
      modified={modified}
      onMount={handleMount}
      options={{
        renderSideBySide,
        useInlineViewWhenSpaceIsLimited: false,
        minimap: { enabled: false },
        lineNumbers: "on",
        automaticLayout: true,
        scrollBeyondLastLine: false,
        wordWrap: "on",
        wrappingIndent: "indent",
        diffWordWrap: "on",
        renderOverviewRuler: false,
      }}
    />
  );
};
