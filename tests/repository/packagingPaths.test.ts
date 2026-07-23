import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (path: string) => readFileSync(resolve(repoRoot, path), "utf8");

describe("desktop packaging paths", () => {
  it("keeps AUR packaging on the released deb artifact", () => {
    const workflow = read(".github/workflows/aur.yml");
    const pkgbuild = read("aur/PKGBUILD");
    expect(workflow).toContain("Nexora_${{ steps.version.outputs.version }}_amd64.deb");
    expect(workflow).toContain("pkgbuild: ./aur/PKGBUILD");
    expect(pkgbuild).toMatch(/^source=\("https:\/\/github\.com\/privixy\/nexora\/releases\/download\/v\$\{pkgver}\/Nexora_\$\{pkgver}_amd64\.deb"\)$/m);
    expect(workflow).not.toContain("src-tauri/");
  });

  it("keeps Snap packaging on root-owned metadata and the released deb", () => {
    const workflow = read(".github/workflows/snap.yml");
    const snapcraft = read("snap/snapcraft.yaml");
    expect(workflow).toContain("path: snap");
    expect(workflow).toContain("snap/nexora.deb");
    expect(snapcraft).toMatch(/^\s+source:\s*nexora\.deb\s*$/m);
    expect(workflow).not.toContain("src-tauri/");
  });

  it("keeps Winget matching the released NSIS artifact", () => {
    const workflow = read(".github/workflows/winget.yml");
    expect(workflow).toContain("installers-regex: '_x64-setup\\.exe$'");
    expect(workflow).not.toContain("src-tauri/");
  });
});
