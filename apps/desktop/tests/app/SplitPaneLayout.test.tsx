import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { SplitPaneLayout } from "../../src/app/SplitPaneLayout";

const editorPageMock = vi.hoisted(() => vi.fn());
const visualExplainModalMock = vi.hoisted(() => vi.fn());
const visualExplainProps = vi.hoisted(() => ({
  isOpen: true,
  onClose: vi.fn(),
  query: "select 1",
  connectionId: "connection-a",
  schema: "public",
}));
const notebookRuntime = vi.hoisted(() => ({
  NotebookView: vi.fn(),
  createNotebook: vi.fn(),
  editorNotebookAdapter: {},
  renameNotebook: vi.fn(),
}));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("../../src/shared/hooks/useSplitPaneResize", () => ({
  useSplitPaneResize: () => ({ splitRatio: 50, startResize: vi.fn() }),
}));
vi.mock("../../src/app/shell/PanelDatabaseProvider", () => ({
  PanelDatabaseProvider: ({ children, connectionId }: { children: ReactNode; connectionId: string }) => (
    <section data-testid={`database-${connectionId}`}>{children}</section>
  ),
}));
vi.mock("../../src/features/editor", () => ({
  EditorProvider: ({ children }: { children: ReactNode }) => children,
  EditorPage: (props: {
    renderVisualExplain: (props: typeof visualExplainProps) => ReactNode;
  }) => {
    editorPageMock(props);
    return (
      <div data-testid="split-editor">
        {props.renderVisualExplain(visualExplainProps)}
      </div>
    );
  },
}));
vi.mock("../../src/features/notebooks", () => notebookRuntime);
vi.mock("../../src/features/connections", () => ({
  getConnectionAccent: () => "#123456",
  useConnectionLayoutContext: () => ({
    deactivateSplit: vi.fn(),
    removeConnectionFromSplit: vi.fn(),
    explorerConnectionId: "connection-a",
    setExplorerConnectionId: vi.fn(),
  }),
  useDatabase: () => ({
    switchConnection: vi.fn(),
    connectionDataMap: {
      "connection-a": { connectionName: "Primary" },
      "connection-b": { connectionName: "Replica" },
    },
    connections: [
      { id: "connection-a", params: { driver: "sqlite" } },
      { id: "connection-b", params: { driver: "sqlite" } },
    ],
  }),
}));
vi.mock("../../src/features/plugins", () => ({
  useDrivers: () => ({ allDrivers: [{ id: "sqlite" }] }),
}));
vi.mock("../../src/features/visual-explain", () => ({
  VisualExplainModal: (props: typeof visualExplainProps) => {
    visualExplainModalMock(props);
    return <div data-testid="visual-explain-modal">{props.query}</div>;
  },
}));

describe("SplitPaneLayout", () => {
  it("renders both editor panes and forwards the route visual-explain renderer", () => {
    render(<SplitPaneLayout connectionIds={["connection-a", "connection-b"]} mode="vertical" />);

    expect(screen.getByText("Primary")).toBeVisible();
    expect(screen.getByText("Replica")).toBeVisible();
    expect(screen.getAllByTestId("split-editor")).toHaveLength(2);
    expect(screen.getByTestId("database-connection-a")).toBeVisible();
    expect(screen.getByTestId("database-connection-b")).toBeVisible();
    expect(screen.getAllByTestId("visual-explain-modal")).toHaveLength(2);
    expect(editorPageMock).toHaveBeenCalledTimes(2);
    expect(visualExplainModalMock).toHaveBeenCalledTimes(2);
    expect(visualExplainModalMock).toHaveBeenNthCalledWith(1, visualExplainProps);
    expect(visualExplainModalMock).toHaveBeenNthCalledWith(2, visualExplainProps);
  });
});
