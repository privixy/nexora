import { render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps, ComponentType, ReactNode } from "react";
import { MemoryRouter, Outlet } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "../../src/app/routes";

const navigateMock = vi.hoisted(() => vi.fn());
const editorPageMock = vi.hoisted(() => vi.fn());
const notebookRuntime = vi.hoisted(() => ({
  NotebookView: vi.fn(),
  createNotebook: vi.fn(),
  renameNotebook: vi.fn(),
}));

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

function page(name: string): ComponentType {
  return function Page() {
    return <div data-testid="selected-page">{name}</div>;
  };
}

vi.mock("../../src/app/MainLayout", () => ({
  MainLayout: () => <div data-testid="main-layout"><Outlet /></div>,
}));
vi.mock("../../src/features/connections/pages/ConnectionsPage", () => ({ Connections: page("connections") }));
vi.mock("../../src/features/plugins", () => ({
  PluginSettingsPage: page("plugin-settings"),
  PluginsTab: page("plugins"),
  useDrivers: () => ({ allDrivers: [], installedPlugins: [], refresh: vi.fn() }),
}));
vi.mock("../../src/features/settings", () => ({
  AiActivityPanel: page("ai-activity"),
  SettingsPage: page("settings"),
  SshTab: page("ssh"),
}));
vi.mock("../../src/features/editor", () => ({
  EditorErrorBoundary: ({ children }: { children: ReactNode }) => <div data-testid="editor-error-boundary">{children}</div>,
  EditorPage: (props: unknown) => {
    editorPageMock(props);
    return <div data-testid="selected-page">editor</div>;
  },
  EditorSchemaDiagramPage: page("schema-diagram"),
  ResultsWindowPage: page("results-window"),
}));
vi.mock("../../src/features/notebooks", () => notebookRuntime);
vi.mock("../../src/features/mcp", () => ({ McpPage: page("mcp") }));
vi.mock("../../src/pages/Settings", () => ({ Settings: page("settings") }));
vi.mock("../../src/features/schema/pages/SchemaDiagramPage", () => ({ SchemaDiagramPage: page("schema-diagram") }));
vi.mock("../../src/features/tasks", () => ({ TaskManagerPage: page("task-manager") }));
vi.mock("../../src/features/visual-explain", () => ({
  VisualExplainModal: page("visual-explain-modal"),
  VisualExplainPage: page("visual-explain"),
}));
vi.mock("../../src/features/data-grid", () => ({ JsonViewerPage: page("json-viewer") }));
vi.mock("../../src/features/editor/components/EditorErrorBoundary", () => ({
  EditorErrorBoundary: ({ children }: { children: ReactNode }) => <div data-testid="editor-error-boundary">{children}</div>,
}));

function renderRoutes(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe("AppRoutes", () => {
  afterEach(() => {
    navigateMock.mockClear();
  });

  it("preserves the explicit sorted route fixture, redirect, element wiring, and window-specific pages", async () => {
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
      const view = renderRoutes(path);
      expect(await screen.findByTestId("selected-page")).toHaveTextContent(selections[path].page);
      expect(screen.queryByTestId("main-layout") !== null).toBe(selections[path].shell);
      if (path === "/editor") {
        expect(screen.getByTestId("editor-error-boundary")).toContainElement(screen.getByTestId("selected-page"));
        expect(editorPageMock).toHaveBeenCalledWith({
          notebook: {
            render: notebookRuntime.NotebookView,
            create: notebookRuntime.createNotebook,
            rename: notebookRuntime.renameNotebook,
          },
        });
      }
      if (path === "/") {
        await waitFor(() => expect(navigateMock).toHaveBeenCalledWith(expect.objectContaining({ to: "/connections", replace: true })));
      }
      view.unmount();
    }
  });

  it("preserves the absence of a fallback route", () => {
    renderRoutes("/not-a-route");

    expect(screen.queryByTestId("selected-page")).not.toBeInTheDocument();
    expect(screen.queryByTestId("main-layout")).not.toBeInTheDocument();
  });
});
