import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateDistribution } from "../../scripts/validate-distribution.mjs";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("distribution packaging contracts", () => {
  it("passes static distribution validation", () => {
    expect(validateDistribution({ version: "1.2.3" })).toEqual({ errors: [], warnings: [] });
  });

  it("preserves Snap source renaming and guard", () => {
    const workflow = read(".github/workflows/snap.yml");
    expect(workflow).toContain("-o snap/nexora.deb");
    expect(workflow).toContain("path: snap");
    expect(workflow).toContain("ENABLE_STORE_PUBLISH == 'true'");
  });

  it("uses exact AUR and WinGet release artifacts", () => {
    expect(read("aur/PKGBUILD")).toContain('Nexora_${pkgver}_amd64.deb');
    expect(read(".github/workflows/aur.yml")).not.toContain("force_push: true");
    const winget = read(".github/workflows/winget.yml");
    expect(winget).toContain("identifier: Nexora.Nexora");
    expect(winget).toContain("release-tag");
    expect(winget).toContain("'_x64-setup\\.exe$'");
  });
});
