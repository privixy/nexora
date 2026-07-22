import { render, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { ask } from "@tauri-apps/plugin-dialog";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { CreateForeignKeyModal } from "../../../src/features/schema/components/modals/CreateForeignKeyModal";
import { CreateIndexModal } from "../../../src/features/schema/components/modals/CreateIndexModal";
import { RunRoutineModal } from "../../../src/features/schema/components/modals/RunRoutineModal";
import { SchemaModal } from "../../../src/features/schema/components/modals/SchemaModal";
import { TriggerEditorModal } from "../../../src/features/schema/components/modals/TriggerEditorModal";
import { ViewEditorModal } from "../../../src/features/schema/components/modals/ViewEditorModal";
import { useDataTypes } from "../../../src/hooks/useDataTypes";

const database = vi.hoisted(() => ({
  activeConnectionId: "connection",
  activeDriver: "postgres",
  activeSchema: "public",
  activeCapabilities: { sql_dialect: "postgres" },
}));

const settings = vi.hoisted(() => ({}));
const translate = vi.hoisted(() => (key: string) => key);

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: translate }),
}));

vi.mock("../../../src/features/connections/hooks/useDatabase", () => ({
  useDatabase: () => database,
}));

vi.mock("../../../src/features/plugins", () => ({
  useDrivers: () => ({
    allDrivers: [{ id: "postgres", capabilities: { create_foreign_keys: true } }],
  }),
}));

vi.mock("../../../src/features/settings", () => ({
  useSettings: () => ({ settings }),
}));

vi.mock("../../../src/hooks/useAlert", () => ({
  useAlert: () => ({ showAlert: vi.fn() }),
}));

vi.mock("../../../src/components/ui/SqlEditorWrapper", () => ({
  SqlEditorWrapper: () => null,
}));

vi.mock("../../../src/components/ui/Modal", () => ({
  Modal: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div>{children}</div> : null,
}));

vi.mock("../../../src/components/ui/Select", () => ({
  Select: () => null,
}));

vi.mock("../../../src/components/ui/SqlPreview", () => ({
  SqlPreview: () => null,
}));

vi.mock("../../../src/features/schema/components/ClipboardImport/SchemaEditor", () => ({
  SchemaEditor: () => null,
}));

vi.mock("lucide-react", () => ({
  AlertCircle: () => null,
  AlertTriangle: () => null,
  ArrowDownToLine: () => null,
  CheckCircle2: () => null,
  ChevronDown: () => null,
  ChevronRight: () => null,
  Clipboard: () => null,
  Columns: () => null,
  Database: () => null,
  ExternalLink: () => null,
  Eye: () => null,
  Key: () => null,
  Link: () => null,
  ListTree: () => null,
  Loader2: () => null,
  Maximize2: () => null,
  Play: () => null,
  Plus: () => null,
  Rows: () => null,
  Save: () => null,
  Sparkles: () => null,
  Table2: () => null,
  Trash2: () => null,
  Upload: () => null,
  Variable: () => null,
  X: () => null,
  Zap: () => null,
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({ ask: vi.fn() }));
vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({ readText: vi.fn() }));

const invokeMock = vi.mocked(invoke);
const askMock = vi.mocked(ask);
const readTextMock = vi.mocked(readText);

beforeEach(() => {
  invokeMock.mockReset();
  askMock.mockReset();
  readTextMock.mockReset();
});

describe("schema raw Tauri contracts", () => {
  it("loads table columns with the explicit database context", async () => {
    invokeMock.mockResolvedValueOnce([]);

    render(
      <SchemaModal
        isOpen
        onClose={vi.fn()}
        tableName="users"
        database="app"
        schema="audit"
      />,
    );

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("get_columns", {
        connectionId: "connection",
        tableName: "users",
        database: "app",
        schema: "audit",
      });
    });
  });

  it("loads index columns without normalizing the context", async () => {
    invokeMock.mockResolvedValueOnce([]);

    render(
      <CreateIndexModal
        isOpen
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        connectionId="connection"
        tableName="users"
        driver="postgres"
        database="app"
        schema="audit"
      />,
    );

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("get_columns", {
        connectionId: "connection",
        tableName: "users",
        database: "app",
        schema: "audit",
      });
    });
  });

  it("loads foreign-key tables and columns with the same context", async () => {
    invokeMock.mockResolvedValue([]);

    render(
      <CreateForeignKeyModal
        isOpen
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        connectionId="connection"
        tableName="orders"
        driver="postgres"
        database="app"
        schema="audit"
      />,
    );

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("get_tables", {
        connectionId: "connection",
        database: "app",
        schema: "audit",
      });
      expect(invokeMock).toHaveBeenCalledWith("get_columns", {
        connectionId: "connection",
        tableName: "orders",
        database: "app",
        schema: "audit",
      });
    });
  });

  it("loads routine parameters with exact command arguments", async () => {
    invokeMock.mockResolvedValueOnce([]);

    render(
      <RunRoutineModal
        isOpen
        onClose={vi.fn()}
        connectionId="connection"
        routine={{ name: "refresh_data", routine_type: "PROCEDURE" }}
        database="app"
        schema="audit"
        onRun={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("get_routine_parameters", {
        connectionId: "connection",
        routineName: "refresh_data",
        database: "app",
        schema: "audit",
      });
    });
  });

  it("loads view definitions with exact command arguments", async () => {
    invokeMock.mockResolvedValueOnce("SELECT 1");

    render(
      <ViewEditorModal
        isOpen
        onClose={vi.fn()}
        connectionId="connection"
        viewName="active_users"
        database="app"
        schema="audit"
      />,
    );

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("get_view_definition", {
        connectionId: "connection",
        viewName: "active_users",
        database: "app",
        schema: "audit",
      });
    });
  });

  it("loads trigger definitions with exact command arguments", async () => {
    invokeMock.mockResolvedValueOnce("CREATE TRIGGER update_user BEFORE UPDATE ON users FOR EACH ROW BEGIN END");

    render(
      <TriggerEditorModal
        isOpen
        onClose={vi.fn()}
        connectionId="connection"
        triggerName="update_user"
        tableName="users"
        database="app"
        schema="audit"
      />,
    );

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("get_trigger_definition", {
        connectionId: "connection",
        triggerName: "update_user",
        tableName: "users",
        database: "app",
        schema: "audit",
      });
    });
  });

  it("forwards clipboard text and inferred types without normalization", async () => {
    readTextMock.mockResolvedValueOnce("id\n1");
    invokeMock.mockImplementation((command) => {
      if (command === "map_inferred_column_types") return Promise.resolve(["INTEGER"]);
      if (command === "get_tables") return Promise.resolve([]);
      return Promise.resolve([]);
    });
    const { ClipboardImportModal } = await import(
      "../../../src/features/schema/components/ClipboardImportModal"
    );

    render(<ClipboardImportModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);

    await waitFor(() => {
      expect(readTextMock).toHaveBeenCalledWith();
      expect(invokeMock).toHaveBeenCalledWith("map_inferred_column_types", {
        driver: "postgres",
        kinds: ["INTEGER"],
      });
      expect(invokeMock).toHaveBeenCalledWith("get_tables", {
        connectionId: "connection",
        schema: "public",
      });
    });
  });

  it("loads data types with the exact driver and preserves the rejection", async () => {
    const rejection = new Error("unavailable");
    invokeMock.mockRejectedValueOnce(rejection);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { result } = renderHook(() => useDataTypes("cockroach"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(invokeMock).toHaveBeenCalledWith("get_data_types", { driver: "cockroach" });
    expect(result.current.error).toBe(String(rejection));
    expect(consoleError).toHaveBeenCalledWith("Failed to fetch data types:", rejection);
    consoleError.mockRestore();
  });
});
