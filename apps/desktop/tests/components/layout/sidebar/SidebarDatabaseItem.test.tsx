import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SidebarDatabaseItem } from "../../../../src/components/layout/sidebar/SidebarDatabaseItem";
import type { DatabaseData } from "../../../../src/contexts/DatabaseContext";
import type { DriverCapabilities } from "../../../../src/types/plugins";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("lucide-react")>();
  return actual;
});

const createDatabaseData = (schemaName = "public"): DatabaseData => ({
  tables: [],
  views: [],
  routines: [],
  triggers: [],
  isLoading: false,
  isLoaded: true,
  schemas: [schemaName],
  schemaDataMap: {
    [schemaName]: {
      tables: [{ name: "users" }],
      views: [],
      routines: [],
      triggers: [],
      isLoading: false,
      isLoaded: true,
    },
  },
  activeSchema: schemaName,
  selectedSchemas: [schemaName],
  needsSchemaSelection: false,
});

const defaultProps = {
  databaseName: "app",
  databaseData: createDatabaseData(),
  activeTable: null,
  activeDatabase: "app",
  activeSchema: "public",
  connectionId: "conn-1",
  driver: "postgres",
  schemaVersion: 1,
  onLoadDatabase: vi.fn(),
  onRefreshDatabase: vi.fn(),
  onLoadDatabaseSchema: vi.fn(),
  onRefreshDatabaseSchema: vi.fn(),
  onActivateDatabase: vi.fn(),
  onActivateDatabaseSchema: vi.fn(),
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
  onCreateSchema: vi.fn(),
  onDump: vi.fn(),
  onImport: vi.fn(),
  onViewDiagram: vi.fn(),
  capabilities: { schemas: true, triggers: true } as DriverCapabilities,
};

describe("SidebarDatabaseItem", () => {
  it("shows only the active database content when active database changes", () => {
    const { rerender } = render(<SidebarDatabaseItem {...defaultProps} />);

    expect(screen.getByText("users")).toBeInTheDocument();

    rerender(
      <SidebarDatabaseItem
        {...defaultProps}
        databaseName="app"
        activeDatabase="analytics"
        activeSchema="public"
      />,
    );

    expect(screen.queryByText("users")).not.toBeInTheDocument();
  });

  it("does not collapse the active database when its header is clicked", () => {
    render(<SidebarDatabaseItem {...defaultProps} />);

    fireEvent.click(screen.getByText("app"));

    expect(screen.getByText("users")).toBeInTheDocument();
  });
});
