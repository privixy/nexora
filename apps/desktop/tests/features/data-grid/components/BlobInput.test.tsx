import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BlobInput } from "../../../../src/features/data-grid/components/BlobInput";
import { dialogGateway } from "../../../../src/platform/tauri/dialogGateway";
import { queryGateway } from "../../../../src/platform/tauri/queryGateway";
import type { DriverCapabilities } from "../../../../src/features/plugins";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("lucide-react", async (importOriginal) => {
  const original = await importOriginal<typeof import("lucide-react")>();
  return {
    ...original,
    Download: () => null,
    Upload: () => null,
    FileIcon: () => null,
    ImageIcon: () => null,
    Trash2: () => null,
    AlertTriangle: () => null,
    Loader2: () => null,
  };
});

vi.mock("../../../../src/platform/tauri/dialogGateway", () => ({
  dialogGateway: {
    open: vi.fn(),
    save: vi.fn(),
  },
}));

vi.mock("../../../../src/platform/tauri/fileGateway", () => ({
  fileGateway: {
    writeFile: vi.fn(),
  },
}));

vi.mock("../../../../src/platform/tauri/queryGateway", () => ({
  queryGateway: {
    invoke: vi.fn(),
  },
}));

const capabilities = (
  overrides: Partial<DriverCapabilities>,
): DriverCapabilities => overrides as DriverCapabilities;

const contextCases = [
  {
    name: "schema-only",
    capabilities: capabilities({ schemas: true, multiple_databases: false }),
    database: undefined,
    schema: "reporting",
  },
  {
    name: "database-only",
    capabilities: capabilities({ schemas: false, multiple_databases: true }),
    database: "analytics",
    schema: undefined,
  },
  {
    name: "full-tuple",
    capabilities: capabilities({ schemas: true, multiple_databases: true }),
    database: "analytics",
    schema: "reporting",
  },
];

describe("BlobInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(queryGateway.invoke).mockResolvedValue("data:image/png;base64,AAAA");
    vi.mocked(dialogGateway.save).mockResolvedValue("/tmp/download.png");
  });

  it.each(contextCases)(
    "uses the complete $name explicit row context for truncated preview and download",
    async ({ capabilities, database, schema }) => {
      render(
        <BlobInput
          value="BLOB:100:image/png:AAAA"
          dataType="BLOB"
          onChange={vi.fn()}
          connectionId="conn-1"
          capabilities={capabilities}
          database={database}
          schema={schema}
          tableName="assets"
          pkMap={{ id: 7 }}
          colName="payload"
        />,
      );

      await waitFor(() => {
        expect(queryGateway.invoke).toHaveBeenCalledWith(
          "fetch_blob_as_data_url",
          {
            connectionId: "conn-1",
            database,
            schema,
            table: "assets",
            colName: "payload",
            pkMap: { id: 7 },
          },
        );
      });

      fireEvent.click(screen.getByTitle("blobInput.download"));

      await waitFor(() => {
        expect(queryGateway.invoke).toHaveBeenCalledWith("save_blob_to_file", {
          connectionId: "conn-1",
          database,
          schema,
          table: "assets",
          colName: "payload",
          pkMap: { id: 7 },
          filePath: "/tmp/download.png",
        });
      });
    },
  );

  it("does not fetch a truncated blob with incomplete explicit context or stale globals", () => {
    const staleGlobalContext = {
      activeDatabase: "stale_database",
      activeSchema: "stale_schema",
    };

    render(
      <BlobInput
        value="BLOB:100:image/png:AAAA"
        dataType="BLOB"
        onChange={vi.fn()}
        connectionId="conn-1"
        capabilities={capabilities({ schemas: true, multiple_databases: true })}
        database="analytics"
        tableName="assets"
        pkMap={{ id: 7 }}
        colName="payload"
      />,
    );

    expect(staleGlobalContext).toEqual({
      activeDatabase: "stale_database",
      activeSchema: "stale_schema",
    });
    expect(queryGateway.invoke).not.toHaveBeenCalled();
    expect(screen.getByTitle("blobInput.downloadDisabledTruncated")).toBeDisabled();
  });
});
