import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps, ComponentType, ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { App } from "../../src/app/App";
import { useChangelog } from "../../src/hooks/useChangelog";
import { useResultTypeColors } from "../../src/hooks/useResultTypeColors";
import { useSettings } from "../../src/hooks/useSettings";
import { useUpdate } from "../../src/hooks/useUpdate";
import { APP_VERSION } from "../../src/version";

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    Navigate: (props: ComponentProps<typeof actual.Navigate>) => {
      navigateMock(props);
      return actual.Navigate(props);
    },
  };
});

const providerNames = [
  "AlertProvider",
  "KeybindingsProvider",
  "PluginSlotProvider",
  "PluginModalProvider",
  "ConnectionLayoutProvider",
] as const;

const routePaths = [
  "/",
  "/connections",
  "/editor",
  "/json-viewer",
  "/mcp",
  "/results-window",
  "/schema-diagram",
  "/settings",
  "/task-manager",
  "/visual-explain",
] as const;

function provider(name: string) {
  return function Provider({ children }: { children: ReactNode }) {
    return <div data-provider={name}>{children}</div>;
  };
}

function page(name: string): ComponentType {
  return function Page() {
    return <div data-testid="selected-page">{name}</div>;
  };
}

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("../../src/contexts/AlertProvider", () => ({ AlertProvider: provider("AlertProvider") }));
vi.mock("../../src/contexts/KeybindingsProvider", () => ({ KeybindingsProvider: provider("KeybindingsProvider") }));
vi.mock("../../src/contexts/PluginSlotProvider", () => ({ PluginSlotProvider: provider("PluginSlotProvider") }));
vi.mock("../../src/contexts/PluginModalProvider", () => ({ PluginModalProvider: provider("PluginModalProvider") }));
vi.mock("../../src/contexts/ConnectionLayoutProvider", () => ({ ConnectionLayoutProvider: provider("ConnectionLayoutProvider") }));
vi.mock("../../src/components/layout/MainLayout", () => ({
  MainLayout: () => <div data-testid="main-layout"><Outlet /></div>,
}));
vi.mock("../../src/pages/Connections", () => ({ Connections: page("connections") }));
vi.mock("../../src/pages/Editor", () => ({ Editor: page("editor") }));
vi.mock("../../src/pages/McpPage", () => ({ McpPage: page("mcp") }));
vi.mock("../../src/pages/Settings", () => ({ Settings: page("settings") }));
vi.mock("../../src/pages/SchemaDiagramPage", () => ({ SchemaDiagramPage: page("schema-diagram") }));
vi.mock("../../src/pages/TaskManagerPage", () => ({ TaskManagerPage: page("task-manager") }));
vi.mock("../../src/pages/VisualExplainPage", () => ({ VisualExplainPage: page("visual-explain") }));
vi.mock("../../src/pages/JsonViewerPage", () => ({ JsonViewerPage: page("json-viewer") }));
vi.mock("../../src/pages/ResultsWindowPage", () => ({ ResultsWindowPage: page("results-window") }));
vi.mock("../../src/components/ConnectionHealthMonitor", () => ({
  ConnectionHealthMonitor: () => <div data-testid="connection-health-monitor" />,
}));
vi.mock("../../src/components/ui/EditorErrorBoundary", () => ({
  EditorErrorBoundary: ({ children }: { children: ReactNode }) => <div data-testid="editor-error-boundary">{children}</div>,
}));
vi.mock("../../src/components/modals/UpdateNotificationModal", () => ({
  UpdateNotificationModal: ({ isOpen, error }: { isOpen: boolean; error: string | null }) => (
    <div data-testid="update-modal" data-open={String(isOpen)} data-error={error ?? ""} />
  ),
}));
vi.mock("../../src/components/modals/WhatsNewModal", () => ({
  WhatsNewModal: ({ isOpen, entries, isLoading }: { isOpen: boolean; entries: Array<{ version: string }>; isLoading: boolean }) => (
    <div data-testid="whats-new-modal" data-open={String(isOpen)} data-entries={entries.map(({ version }) => version).join(",")} data-loading={String(isLoading)} />
  ),
}));
vi.mock("../../src/components/modals/AiApprovalGate", () => ({ AiApprovalGate: () => <div data-testid="ai-approval-gate" /> }));
vi.mock("../../src/components/modals/SshAskpassGate", () => ({ SshAskpassGate: () => <div data-testid="ssh-askpass-gate" /> }));
vi.mock("../../src/hooks/useUpdate", () => ({ useUpdate: vi.fn() }));
vi.mock("../../src/hooks/useSettings", () => ({ useSettings: vi.fn() }));
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

    const selectedPage = await screen.findByTestId("selected-page");
    const actualOrder: string[] = [];
    let current: Element | null = selectedPage.parentElement;
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

  it("pins the explicit sorted route fixture and visible shell or window page", async () => {
    const selections: Record<(typeof routePaths)[number], { page: string; shell: boolean }> = {
      "/": { page: "connections", shell: true },
      "/connections": { page: "connections", shell: true },
      "/editor": { page: "editor", shell: true },
      "/json-viewer": { page: "json-viewer", shell: false },
      "/mcp": { page: "mcp", shell: true },
      "/results-window": { page: "results-window", shell: false },
      "/schema-diagram": { page: "schema-diagram", shell: false },
      "/settings": { page: "settings", shell: true },
      "/task-manager": { page: "task-manager", shell: false },
      "/visual-explain": { page: "visual-explain", shell: false },
    };

    expect(Object.keys(selections).sort()).toEqual(routePaths);

    for (const path of routePaths) {
      const view = renderApp(path);
      expect(await screen.findByTestId("selected-page")).toHaveTextContent(selections[path].page);
      expect(screen.queryByTestId("main-layout") !== null).toBe(selections[path].shell);
      if (path === "/editor") {
        expect(screen.getByTestId("editor-error-boundary")).toContainElement(screen.getByTestId("selected-page"));
      }
      if (path === "/") {
        await waitFor(() => expect(window.location.pathname).toBe("/connections"));
        expect(navigateMock).toHaveBeenCalledWith(expect.objectContaining({ to: "/connections", replace: true }));
      }
      view.unmount();
    }
  });

  it("pins the absence of a fallback route while retaining global gates", async () => {
    renderApp("/not-a-route");

    await waitFor(() => expect(invoke).toHaveBeenCalledWith("is_debug_mode"));
    expect(screen.queryByTestId("selected-page")).not.toBeInTheDocument();
    expect(screen.queryByTestId("main-layout")).not.toBeInTheDocument();
    expect(screen.getByTestId("ai-approval-gate")).toBeInTheDocument();
    expect(screen.getByTestId("ssh-askpass-gate")).toBeInTheDocument();
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
