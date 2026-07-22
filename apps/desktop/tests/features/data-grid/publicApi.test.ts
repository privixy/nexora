import { describe, expect, it } from "vitest";
import {
  DataGrid,
  JsonViewerPage,
  type DataGridProps,
  type JsonInputProps,
  type JsonTreeViewProps,
  type RowEditorSidebarProps,
} from "../../../src/features/data-grid";

describe("data-grid public API", () => {
  it("publishes supported components and contracts", () => {
    expect(DataGrid).toBeDefined();
    expect(JsonViewerPage).toBeDefined();

    const dataGridProps = {} as DataGridProps;
    const jsonInputProps = {} as JsonInputProps;
    const jsonTreeViewProps = {} as JsonTreeViewProps;
    const rowEditorSidebarProps = {} as RowEditorSidebarProps;

    expect(dataGridProps).toBeDefined();
    expect(jsonInputProps).toBeDefined();
    expect(jsonTreeViewProps).toBeDefined();
    expect(rowEditorSidebarProps).toBeDefined();
  });
});
