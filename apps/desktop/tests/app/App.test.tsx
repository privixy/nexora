import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { App } from "../../src/app/App";
import { useChangelog } from "../../src/hooks/useChangelog";
import { useResultTypeColors } from "../../src/hooks/useResultTypeColors";
import { useSettings } from "../../src/features/settings/hooks/useSettings";
import { useUpdate } from "../../src/features/settings/hooks/useUpdate";
import { APP_VERSION } from "../../src/app/config/version";

const providerNames = [
  "AlertProvider",
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

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("../../src/app/AlertProvider", () => ({ AlertProvider: provider("AlertProvider") }));
vi.mock("../../src/contexts/KeybindingsProvider", () => ({ KeybindingsProvider: provider("KeybindingsProvider") }));
vi.mock("../../src/features/plugins/state/PluginSlotProvider", () => ({ PluginSlotProvider: provider("PluginSlotProvider") }));
vi.mock("../../src/features/plugins/state/PluginModalProvider", () => ({ PluginModalProvider: provider("PluginModalProvider") }));
vi.mock("../../src/app/ConnectionLayoutProvider", () => ({ ConnectionLayoutProvider: provider("ConnectionLayoutProvider") }));
vi.mock("../../src/features/editor", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/features/editor")>()),
  EditorProvider: provider("EditorProvider"),
  QueryHistoryProvider: provider("QueryHistoryProvider"),
  SavedQueriesProvider: provider("SavedQueriesProvider"),
}));
vi.mock("../../src/app/routes", () => ({ AppRoutes: () => <div data-testid="app-routes" /> }));
vi.mock("../../src/features/connections/components/ConnectionHealthMonitor", () => ({
  ConnectionHealthMonitor: () => <div data-testid="connection-health-monitor" />,
}));
vi.mock("../../src/shared/ui/UpdateNotificationModal", () => ({
  UpdateNotificationModal: ({ isOpen, error }: { isOpen: boolean; error: string | null }) => (
    <div data-testid="update-modal" data-open={String(isOpen)} data-error={error ?? ""} />
  ),
}));
vi.mock("../../src/shared/ui/WhatsNewModal", () => ({
  WhatsNewModal: ({ isOpen, entries, isLoading }: { isOpen: boolean; entries: Array<{ version: string }>; isLoading: boolean }) => (
    <div data-testid="whats-new-modal" data-open={String(isOpen)} data-entries={entries.map(({ version }) => version).join(",")} data-loading={String(isLoading)} />
  ),
}));
vi.mock("../../src/features/settings/components/AiApprovalGate", () => ({ AiApprovalGate: () => <div data-testid="ai-approval-gate" /> }));
vi.mock("../../src/shared/ui/SshAskpassGate", () => ({ SshAskpassGate: () => <div data-testid="ssh-askpass-gate" /> }));
vi.mock("../../src/features/settings/hooks/useUpdate", () => ({ useUpdate: vi.fn() }));
vi.mock("../../src/features/settings/hooks/useSettings", () => ({ useSettings: vi.fn() }));
vi.mock("../../src/hooks/useChangelog", () => ({ useChangelog: vi.fn() }));
vi.mock("../../src/hooks/useResultTypeColors", () => ({ useResultTypeColors: vi.fn() }));

function setPath(path: string) {
  window.history.replaceState({}, "", path);
}

function renderApp(path = "/connections") {
  setPath(path);
  return render(<App />);
}

describe("legacy App composition root", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(invoke).mockResolvedValue(false);
    vi.mocked(useUpdate).mockReturnValue({
      updateInfo: null,
      isDownloading: false,
      downloadProgress: 0,
      downloadAndInstall: vi.fn(),
      dismissUpdate: vi.fn(),
      error: null,
    } as never);
    vi.mocked(useSettings).mockReturnValue({
      settings: { showWelcome: true },
      isLoading: false,
    } as never);
    vi.mocked(useChangelog).mockReturnValue({ entries: [], isLoading: false } as never);
  });

  afterEach(() => {
    setPath("/");
  });

  it("pins the explicit provider nesting order and global composition", async () => {
    renderApp();

    const appRoutes = await screen.findByTestId("app-routes");
    const actualOrder: string[] = [];
    let current: Element | null = appRoutes.parentElement;
    while (current) {
      const name = current.getAttribute("data-provider");
      if (name) actualOrder.unshift(name);
      current = current.parentElement;
    }

    expect(actualOrder).toEqual(providerNames);
    expect(screen.getByTestId("connection-health-monitor")).toBeInTheDocument();
    expect(screen.getByTestId("update-modal")).toHaveAttribute("data-open", "false");
    expect(screen.getByTestId("whats-new-modal")).toHaveAttribute("data-open", "false");
    expect(screen.getByTestId("ai-approval-gate")).toBeInTheDocument();
    expect(screen.getByTestId("ssh-askpass-gate")).toBeInTheDocument();
    expect(useResultTypeColors).toHaveBeenCalled();
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("is_debug_mode"));
  });

  it("pins startup state, modal error propagation, changelog filtering, and version seeding", async () => {
    localStorage.setItem("nexora_last_seen_version", "1.0.0");
    vi.mocked(useUpdate).mockReturnValue({
      updateInfo: { version: "2.0.0" },
      isDownloading: false,
      downloadProgress: 0,
      downloadAndInstall: vi.fn(),
      dismissUpdate: vi.fn(),
      error: "update failed",
    } as never);
    vi.mocked(useSettings).mockReturnValue({ settings: { showWelcome: false }, isLoading: false } as never);
    vi.mocked(useChangelog).mockReturnValue({
      entries: [{ version: "0.9.0" }, { version: "1.0.1" }, { version: "99.0.0" }],
      isLoading: true,
    } as never);

    renderApp();

    expect(screen.getByTestId("update-modal")).toHaveAttribute("data-open", "true");
    expect(screen.getByTestId("update-modal")).toHaveAttribute("data-error", "update failed");
    expect(screen.getByTestId("whats-new-modal")).toHaveAttribute("data-open", "true");
    expect(screen.getByTestId("whats-new-modal")).toHaveAttribute("data-entries", "1.0.1");
    expect(screen.getByTestId("whats-new-modal")).toHaveAttribute("data-loading", "true");

    localStorage.clear();
    renderApp();
    await waitFor(() => expect(localStorage.getItem("nexora_last_seen_version")).toBe(APP_VERSION));
  });

  it("pins context-menu listener timing, debug branch, and cleanup", async () => {
    let resolveDebug: (value: boolean) => void = () => undefined;
    vi.mocked(invoke).mockReturnValue(new Promise<boolean>((resolve) => { resolveDebug = resolve; }));
    const addSpy = vi.spyOn(document, "addEventListener");
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const view = renderApp();

    expect(addSpy).toHaveBeenCalledWith("contextmenu", expect.any(Function));
    const beforeDebug = new MouseEvent("contextmenu", { cancelable: true });
    fireEvent(document, beforeDebug);
    expect(beforeDebug.defaultPrevented).toBe(true);

    resolveDebug(true);
    await waitFor(() => expect(removeSpy).toHaveBeenCalledWith("contextmenu", expect.any(Function)));
    const inDebug = new MouseEvent("contextmenu", { cancelable: true });
    fireEvent(document, inDebug);
    expect(inDebug.defaultPrevented).toBe(false);

    view.unmount();
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("removes the active context-menu listener on unmount", () => {
    const view = renderApp();
    const whileMounted = new MouseEvent("contextmenu", { cancelable: true });
    fireEvent(document, whileMounted);
    expect(whileMounted.defaultPrevented).toBe(true);

    view.unmount();
    const afterUnmount = new MouseEvent("contextmenu", { cancelable: true });
    fireEvent(document, afterUnmount);
    expect(afterUnmount.defaultPrevented).toBe(false);
  });
});
