import type { ComponentType } from "react";
import type { OnMount } from "@monaco-editor/react";

export interface SqlEditorProps {
  initialValue: string;
  onChange: (value: string) => void;
  onRun: () => void;
  onMount?: OnMount;
  height?: string | number;
  options?: Record<string, unknown>;
  editorKey?: string;
}

export type SqlEditorComponent = ComponentType<SqlEditorProps>;
