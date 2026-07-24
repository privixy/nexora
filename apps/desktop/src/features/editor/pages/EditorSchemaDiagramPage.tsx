import { SchemaDiagramPage } from "../../schema";
import { useEditor } from "../hooks/useEditor";

export function EditorSchemaDiagramPage() {
  const { getSchema } = useEditor();
  return <SchemaDiagramPage getSchema={getSchema} />;
}
