import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { LocalizationTab } from "../../../src/components/settings/LocalizationTab";
import { useSettings } from "../../../src/hooks/useSettings";
import { DEFAULT_SETTINGS } from "../../../src/contexts/SettingsContext";

vi.mock("../../../src/hooks/useSettings", () => ({
  useSettings: vi.fn(),
}));

describe("LocalizationTab", () => {
  const updateSetting = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useSettings).mockReturnValue({
      settings: DEFAULT_SETTINGS,
      updateSetting,
      isLoading: false,
      isLanguageReady: true,
      isLanguageSettled: true,
    });
  });

  it("uses a stable dropdown for language selection", () => {
    render(<LocalizationTab />);

    const languageSelect = screen.getAllByRole("button", {
      name: /settings\.auto/i,
    })[0];

    expect(screen.queryByRole("button", { name: "English" })).not.toBeInTheDocument();

    fireEvent.click(languageSelect);
    fireEvent.click(screen.getByRole("button", { name: "English" }));

    expect(updateSetting).toHaveBeenCalledWith("language", "en");
  });
});
