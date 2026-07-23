import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BlobInput } from "../../../../src/features/data-grid/components/BlobInput";
import { dialogGateway } from "../../../../src/platform/tauri/dialogGateway";
import { queryGateway } from "../../../../src/platform/tauri/queryGateway";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("lucide-react", () => ({
  Download: () => null,
  Upload: () => null,
  FileIcon: () => null,
  ImageIcon: () => null,
  Trash2: () => null,
  AlertTriangle: () => null,
  Loader2: () => null,
}));

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

describe("BlobInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(queryGateway.invoke).mockResolvedValue("data:image/png;base64,AAAA");
    vi.mocked(dialogGateway.save).mockResolvedValue("/tmp/download.png");
  });

  it("uses the complete explicit row context for truncated preview and download", async () => {
    render(
      <BlobInput
        value="BLOB:100:image/png:AAAA"
        dataType="BLOB"
        onChange={vi.fn()}
        connectionId="conn-1"
        database="analytics"
        schema="reporting"
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
          database: "analytics",
          schema: "reporting",
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
        database: "analytics",
        schema: "reporting",
        table: "assets",
        colName: "payload",
        pkMap: { id: 7 },
        filePath: "/tmp/download.png",
      });
    });
  });

  it("does not fetch a truncated blob with incomplete explicit context", () => {
    render(
      <BlobInput
        value="BLOB:100:image/png:AAAA"
        dataType="BLOB"
        onChange={vi.fn()}
        connectionId="conn-1"
        database="analytics"
        tableName="assets"
        pkMap={{ id: 7 }}
        colName="payload"
      />,
    );

    expect(queryGateway.invoke).not.toHaveBeenCalled();
    expect(screen.getByTitle("blobInput.downloadDisabledTruncated")).toBeDisabled();
  });
});
