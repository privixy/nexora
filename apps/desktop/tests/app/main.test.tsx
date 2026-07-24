import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const renderMock = vi.fn();
const createRootMock = vi.fn(() => ({ render: renderMock }));

vi.mock("react-dom/client", () => ({ default: { createRoot: createRootMock } }));
vi.mock("../../src/app/App", () => ({ App: function App() { return null; } }));
vi.mock("../../src/features/connections", () => ({ DatabaseProvider: function DatabaseProvider({ children }: { children: ReactNode }) { return children; } }));
vi.mock("../../src/features/settings", () => ({
  SettingsEditorThemeProvider: function SettingsEditorThemeProvider({ children }: { children: ReactNode }) { return children; },
  SettingsProvider: function SettingsProvider({ children }: { children: ReactNode }) { return children; },
  ThemeProvider: function ThemeProvider({ children }: { children: ReactNode }) { return children; },
  UpdateProvider: function UpdateProvider({ children }: { children: ReactNode }) { return children; },
}));
vi.mock("../../src/features/editor/state/SavedQueriesProvider", () => ({ SavedQueriesProvider: function SavedQueriesProvider({ children }: { children: ReactNode }) { return children; } }));
vi.mock("../../src/features/editor/state/QueryHistoryProvider", () => ({ QueryHistoryProvider: function QueryHistoryProvider({ children }: { children: ReactNode }) { return children; } }));
vi.mock("../../src/features/editor/state/EditorProvider", () => ({ EditorProvider: function EditorProvider({ children }: { children: ReactNode }) { return children; } }));
vi.mock("../../src/app/polyfills", () => ({}));
vi.mock("../../src/app/config", () => ({}));
vi.mock("../../src/app/index.css", () => ({}));

function componentName(element: ReactElement) {
  if (typeof element.type === "string") return element.type;
  if (typeof element.type === "symbol") return "StrictMode";
  return element.type.name;
}

function onlyChild(element: ReactElement) {
  return element.props.children as ReactElement;
}

describe("legacy main composition root", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    document.body.innerHTML = '<div id="root"></div>';
  });

  it("starts React on the root element with the exact provider order", async () => {
    await import("../../src/app/main");

    const root = document.getElementById("root");
    expect(createRootMock).toHaveBeenCalledOnce();
    expect(createRootMock).toHaveBeenCalledWith(root);
    expect(renderMock).toHaveBeenCalledOnce();

    const providerOrder: string[] = [];
    let current = renderMock.mock.calls[0][0] as ReactElement;
    while (current) {
      providerOrder.push(componentName(current));
      const child = onlyChild(current);
      if (!child) break;
      current = child;
    }

    expect(providerOrder).toEqual([
      "StrictMode",
      "UpdateProvider",
      "ThemeProvider",
      "SettingsProvider",
      "SettingsEditorThemeProvider",
      "DatabaseProvider",
      "App",
    ]);
  });
});
