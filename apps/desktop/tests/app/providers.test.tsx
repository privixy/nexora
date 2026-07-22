import { render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AppProviders } from "../../src/app/providers";

const providerNames = [
  "AlertProvider",
  "BrowserRouter",
  "KeybindingsProvider",
  "PluginSlotProvider",
  "PluginModalProvider",
  "ConnectionLayoutProvider",
  "SavedQueriesProvider",
  "QueryHistoryProvider",
  "EditorProvider",
] as const;

function provider(name: string) {
  return function Provider({ children }: { children: ReactNode }) {
    return <div data-provider={name}>{children}</div>;
  };
}

const updateNotificationModalMock = vi.hoisted(() => vi.fn());
const whatsNewModalMock = vi.hoisted(() => vi.fn());
const editorProviderMock = vi.hoisted(() => vi.fn());
const aiApprovalGateMock = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", () => ({ BrowserRouter: provider("BrowserRouter") }));
vi.mock("../../src/contexts/AlertProvider", () => ({ AlertProvider: provider("AlertProvider") }));
vi.mock("../../src/contexts/KeybindingsProvider", () => ({ KeybindingsProvider: provider("KeybindingsProvider") }));
vi.mock("../../src/features/plugins/state/PluginSlotProvider", () => ({ PluginSlotProvider: provider("PluginSlotProvider") }));
vi.mock("../../src/features/plugins/state/PluginModalProvider", () => ({ PluginModalProvider: provider("PluginModalProvider") }));
vi.mock("../../src/contexts/ConnectionLayoutProvider", () => ({ ConnectionLayoutProvider: provider("ConnectionLayoutProvider") }));
vi.mock("../../src/features/editor", () => ({
  EditorProvider: ({ children, notebookAdapter }: { children: ReactNode; notebookAdapter: unknown }) => {
    editorProviderMock(notebookAdapter);
    return <div data-provider="EditorProvider">{children}</div>;
  },
  QueryHistoryProvider: provider("QueryHistoryProvider"),
  SavedQueriesProvider: provider("SavedQueriesProvider"),
}));
vi.mock("../../src/features/connections/components/ConnectionHealthMonitor", () => ({
  ConnectionHealthMonitor: () => <div data-testid="connection-health-monitor" />,
}));
vi.mock("../../src/components/modals/UpdateNotificationModal", () => ({
  UpdateNotificationModal: (props: ComponentProps<"div">) => {
    updateNotificationModalMock(props);
    return <div data-testid="update-modal" />;
  },
}));
vi.mock("../../src/components/modals/WhatsNewModal", () => ({
  WhatsNewModal: (props: ComponentProps<"div">) => {
    whatsNewModalMock(props);
    return <div data-testid="whats-new-modal" />;
  },
}));
vi.mock("../../src/features/settings/components/AiApprovalGate", () => ({
  AiApprovalGate: (props: { attentionAdapter: unknown; renderExplainPlan: unknown }) => {
    aiApprovalGateMock(props);
    return <div data-testid="ai-approval-gate" />;
  },
}));
vi.mock("../../src/features/mcp", () => ({ mcpApprovalAttentionAdapter: { focusWindowForApproval: vi.fn() } }));
vi.mock("../../src/features/visual-explain", () => ({ ApprovalExplainPlanView: vi.fn() }));
vi.mock("../../src/components/modals/SshAskpassGate", () => ({ SshAskpassGate: () => <div data-testid="ssh-askpass-gate" /> }));

describe("AppProviders", () => {
  it("preserves provider order, children placement, global render order, and prop forwarding", () => {
    const dismissUpdate = vi.fn();
    const downloadAndInstall = vi.fn();
    const dismissWhatsNew = vi.fn();
    const updateInfo = { version: "2.0.0" };
    const entries = [{ version: "1.1.0" }];

    render(
      <AppProviders
        updateNotification={{
          isOpen: true,
          onClose: dismissUpdate,
          updateInfo: updateInfo as never,
          isDownloading: true,
          downloadProgress: 42,
          onDownloadAndInstall: downloadAndInstall,
          error: "update failed",
        }}
        whatsNew={{
          isOpen: true,
          onClose: dismissWhatsNew,
          entries: entries as never,
          isLoading: true,
        }}
      >
        <div data-testid="provider-child" />
      </AppProviders>,
    );

    const child = screen.getByTestId("provider-child");
    const actualOrder: string[] = [];
    let current: Element | null = child.parentElement;
    while (current) {
      const name = current.getAttribute("data-provider");
      if (name) actualOrder.unshift(name);
      current = current.parentElement;
    }

    expect(actualOrder).toEqual(providerNames);
    expect(child.parentElement).toHaveAttribute("data-provider", "EditorProvider");
    expect(editorProviderMock).toHaveBeenCalledWith(expect.any(Object));
    expect(aiApprovalGateMock).toHaveBeenCalledWith({
      attentionAdapter: expect.any(Object),
      renderExplainPlan: expect.any(Function),
    });
    expect(screen.getByTestId("connection-health-monitor").parentElement).toHaveAttribute("data-provider", "BrowserRouter");
    expect(screen.getByTestId("connection-health-monitor").compareDocumentPosition(child)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(updateNotificationModalMock).toHaveBeenCalledWith({
      isOpen: true,
      onClose: dismissUpdate,
      updateInfo,
      isDownloading: true,
      downloadProgress: 42,
      onDownloadAndInstall: downloadAndInstall,
      error: "update failed",
    });
    expect(whatsNewModalMock).toHaveBeenCalledWith({
      isOpen: true,
      onClose: dismissWhatsNew,
      entries,
      isLoading: true,
    });
    expect(screen.getAllByTestId(/update-modal|whats-new-modal|ai-approval-gate|ssh-askpass-gate/).map(({ dataset }) => dataset.testid)).toEqual([
      "update-modal",
      "whats-new-modal",
      "ai-approval-gate",
      "ssh-askpass-gate",
    ]);
  });
});
