import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useChangelog } from "../../src/features/settings/hooks/useChangelog";

describe("useChangelog", () => {
  it("loads entries from the bundled changelog", () => {
    const { result } = renderHook(() => useChangelog());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.entries[0]).toMatchObject({
      version: "1.1.0",
      features: expect.arrayContaining(["Add frontend Tauri platform gateways"]),
    });
    expect(result.current.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          version: "0.15.0",
          features: expect.arrayContaining(["Rebranded project to Nexora"]),
        }),
      ]),
    );
  });
});
