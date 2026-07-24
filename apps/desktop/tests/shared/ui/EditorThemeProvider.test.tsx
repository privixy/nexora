import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CellCodeEditor } from "../../../src/shared/ui/CellCodeEditor";
import { EditorThemeProvider } from "../../../src/shared/ui/EditorThemeProvider";
import type { Theme } from "../../../src/shared/types/theme";

vi.mock("@monaco-editor/react", () => ({
  default: ({ theme }: { theme?: string }) => (
    <div data-testid="editor" data-theme={theme} />
  ),
}));

vi.mock("../../../src/features/settings/themes/themeUtils", () => ({
  loadMonacoTheme: vi.fn(),
}));

const theme = {
  id: "injected-theme",
  name: "Injected theme",
  monacoTheme: { themeName: "injected-theme" },
} as unknown as Theme;

describe("EditorThemeProvider", () => {
  it("injects the Monaco theme into shared cell editors", () => {
    render(
      <EditorThemeProvider theme={theme}>
        <CellCodeEditor value="" onChange={vi.fn()} />
      </EditorThemeProvider>,
    );

    expect(screen.getByTestId("editor")).toHaveAttribute(
      "data-theme",
      "injected-theme",
    );
  });
});
