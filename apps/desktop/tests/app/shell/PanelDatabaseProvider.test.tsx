import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { DatabaseContext, type DatabaseContextType } from "@/features/connections";
import { PanelDatabaseProvider } from "@/app/shell/PanelDatabaseProvider";

const sharedContext = {
  connectionDataMap: {
    "connection-b": {
      driver: "postgres",
      capabilities: { schemas: true },
      connectionName: "Reporting",
      databaseName: "reports",
      activeDatabase: "analytics",
      tables: [{ name: "events" }],
      views: [],
      routines: [],
      schemas: ["public"],
      schemaDataMap: {},
      activeSchema: "public",
      selectedSchemas: ["public"],
      needsSchemaSelection: false,
      selectedDatabases: ["analytics"],
      databaseDataMap: {},
    },
  },
  setActiveTableContext: vi.fn(),
  refreshTables: vi.fn(),
  refreshViews: vi.fn(),
  refreshRoutines: vi.fn(),
  loadSchemaData: vi.fn(),
  refreshSchemaData: vi.fn(),
  setSelectedSchemas: vi.fn(),
  loadDatabaseData: vi.fn(),
  refreshDatabaseData: vi.fn(),
  loadDatabaseSchemaData: vi.fn(),
  refreshDatabaseSchemaData: vi.fn(),
  setSelectedDatabases: vi.fn(),
} as unknown as DatabaseContextType;

function Wrapper({ children }: { children: ReactNode }) {
  return <DatabaseContext.Provider value={sharedContext}>{children}</DatabaseContext.Provider>;
}

function Consumer() {
  return (
    <DatabaseContext.Consumer>
      {(context) => (
        <button onClick={() => context?.refreshTables()}>
          {context?.activeConnectionId}:{context?.activeDatabase}:{context?.activeSchema}:{context?.tables[0]?.name}
        </button>
      )}
    </DatabaseContext.Consumer>
  );
}

describe("PanelDatabaseProvider", () => {
  it("scopes visible database state and mutations to the panel connection", () => {
    render(
      <PanelDatabaseProvider connectionId="connection-b">
        <Consumer />
      </PanelDatabaseProvider>,
      { wrapper: Wrapper },
    );

    const consumer = screen.getByRole("button", {
      name: "connection-b:analytics:public:events",
    });
    act(() => consumer.click());

    expect(sharedContext.refreshTables).toHaveBeenCalledWith("connection-b");
  });
});
