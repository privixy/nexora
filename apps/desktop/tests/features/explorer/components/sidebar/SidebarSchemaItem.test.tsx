import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { SidebarSchemaItem } from "../../../../../src/features/explorer/components/sidebar/SidebarSchemaItem";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(() => Promise.resolve([])),
}));

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({ t: (key: string) => key }),
  };
});

vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("lucide-react")>();
  return actual;
});

describe("SidebarSchemaItem — materialized view double-click", () => {
  const baseSchemaData = {
    tables: [],
    views: [],
    materializedViews: [],
    routines: [],
    triggers: [],
    isLoaded: true,
    isLoading: false,
  };

  const defaultProps = {
    schemaName: "public",
    activeTable: null,
    // Matching activeSchema auto-expands the schema body on first render.
    activeSchema: "public",
    connectionId: "conn-123",
    driver: "postgres",
    schemaVersion: 1,
    onLoadSchema: vi.fn(),
    onRefreshSchema: vi.fn(),
    onActivateSchema: vi.fn(),
    onTableClick: vi.fn(),
    onTableDoubleClick: vi.fn(),
    onViewClick: vi.fn(),
    onViewDoubleClick: vi.fn(),
    onRoutineDoubleClick: vi.fn(),
    onTriggerDoubleClick: vi.fn(),
    onContextMenu: vi.fn(),
    onAddColumn: vi.fn(),
    onEditColumn: vi.fn(),
    onAddIndex: vi.fn(),
    onDropIndex: vi.fn(),
    onAddForeignKey: vi.fn(),
    onDropForeignKey: vi.fn(),
    onCreateTable: vi.fn(),
    onCreateView: vi.fn(),
    onCreateTrigger: vi.fn(),
  };

  beforeEach(() => {
    vi.mocked(invoke).mockClear();
  });

  it("passes database and schema to nested table metadata requests", async () => {
    vi.mocked(invoke).mockResolvedValue([]);

    render(
      <SidebarSchemaItem
        {...defaultProps}
        database="analytics"
        schemaData={{ ...baseSchemaData, tables: [{ name: "users" }] }}
      />,
    );

    fireEvent.click(screen.getByLabelText("sidebar.expandTable"));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("get_columns", {
        connectionId: "conn-123",
        tableName: "users",
        database: "analytics",
        schema: "public",
      });
      expect(invoke).toHaveBeenCalledWith("get_foreign_keys", {
        connectionId: "conn-123",
        tableName: "users",
        database: "analytics",
        schema: "public",
      });
      expect(invoke).toHaveBeenCalledWith("get_indexes", {
        connectionId: "conn-123",
        tableName: "users",
        database: "analytics",
        schema: "public",
      });
    });
  });

  it("includes database and schema in nested table context payloads", () => {
    const onContextMenu = vi.fn();

    render(
      <SidebarSchemaItem
        {...defaultProps}
        database="analytics"
        onContextMenu={onContextMenu}
        schemaData={{ ...baseSchemaData, tables: [{ name: "users" }] }}
      />,
    );

    fireEvent.contextMenu(screen.getByText("users"));

    expect(onContextMenu).toHaveBeenCalledWith(
      expect.anything(),
      "table",
      "users",
      "users",
      {
        tableName: "users",
        database: "analytics",
        schema: "public",
      },
    );
  });

  it("flags a materialized view (materialized=true) on double-click", () => {
    const onViewDoubleClick = vi.fn();
    render(
      <SidebarSchemaItem
        {...defaultProps}
        onViewDoubleClick={onViewDoubleClick}
        schemaData={{
          ...baseSchemaData,
          materializedViews: [{ name: "mv_sales" }],
        }}
      />,
    );

    // The materialized-views group is collapsed by default — open it first.
    fireEvent.click(screen.getByText("sidebar.materializedViews (1)"));
    fireEvent.doubleClick(screen.getByText("mv_sales"));

    expect(onViewDoubleClick).toHaveBeenCalledWith("mv_sales", "public", true);
  });

  it("does not flag a regular view as materialized on double-click", () => {
    const onViewDoubleClick = vi.fn();
    render(
      <SidebarSchemaItem
        {...defaultProps}
        onViewDoubleClick={onViewDoubleClick}
        schemaData={{ ...baseSchemaData, views: [{ name: "v_active" }] }}
      />,
    );

    fireEvent.click(screen.getByText("sidebar.views (1)"));
    fireEvent.doubleClick(screen.getByText("v_active"));

    // Called with only (name, schema) — the materialized arg stays undefined.
    expect(onViewDoubleClick).toHaveBeenCalledWith("v_active", "public");
    expect(onViewDoubleClick).not.toHaveBeenCalledWith(
      "v_active",
      "public",
      true,
    );
  });
});
