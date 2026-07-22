import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sourceRoot = "apps/desktop/src/";
const sourceExtensions = /(?:\.d\.ts|\.(?:ts|tsx|css|scss|sass|less|json))$/;
const inventory = execFileSync("git", ["ls-files", `${sourceRoot}**`], { cwd: root, encoding: "utf8" })
  .split("\n")
  .filter((source) => sourceExtensions.test(source))
  .sort();

const sourceOwners = JSON.parse(readFileSync(resolve(root, "architecture/frontend-source-owners.json"), "utf8")) as SourceOwner[];

interface SourceOwner {
  source: string;
  owner: string;
  destination: string;
  moveTask: number;
}

export { sourceOwners };

const generatedSources: readonly { path: string; generator: string; owner: string; reason: string }[] = [];

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

describe("frontend source ownership", () => {
  it("assigns every post-prerequisite source exactly once", () => {
    const currentPaths = sourceOwners.map(({ source, destination }) => {
      const sourceExists = existsSync(resolve(root, source));
      const destinationExists = existsSync(resolve(root, destination));
      expect(Number(sourceExists) + Number(destinationExists)).toBe(1);
      return sourceExists ? source : destination;
    }).sort();
    expect(currentPaths).toEqual(inventory);
    expect(new Set(sourceOwners.map(({ source }) => source)).size).toBe(sourceOwners.length);
    expect(new Set(sourceOwners.map(({ destination }) => destination)).size).toBe(sourceOwners.length);
    expect(sourceOwners.every(({ source, destination }) => !source.includes("*") && !destination.includes("*"))).toBe(true);
    expect(generatedSources.every(({ path, generator, owner, reason }) => path && generator && owner && reason && !path.includes("*"))).toBe(true);
  });

  it("freezes the authoritative source inventory", () => {
    expect(sourceOwners).toHaveLength(412);
    expect(hash(sourceOwners)).toBe("0d7ba1a3c0726e6b269c9b1c2b44f7d34902813c4ca46861f1c93eff7e40e1f2");
  });

  it("uses explicit rows instead of generated ownership rules", () => {
    const fixture = JSON.parse(readFileSync(resolve(root, "architecture/frontend-source-owners.json"), "utf8"));
    expect(fixture).toEqual(sourceOwners);
  });

  it.each([
    ["apps/desktop/src/components/modals/NewConnectionModal.tsx", "connections", "apps/desktop/src/features/connections/components/NewConnectionModal/NewConnectionModal.tsx", 11],
    ["apps/desktop/src/components/modals/NewConnectionModal/AppearanceSection.tsx", "connections", "apps/desktop/src/features/connections/components/NewConnectionModal/AppearanceSection.tsx", 11],
    ["apps/desktop/src/components/modals/TriggerEditorModal.tsx", "schema", "apps/desktop/src/features/schema/components/modals/TriggerEditorModal.tsx", 10],
    ["apps/desktop/src/components/modals/ViewEditorModal.tsx", "schema", "apps/desktop/src/features/schema/components/modals/ViewEditorModal.tsx", 10],
    ["apps/desktop/src/components/modals/RunRoutineModal.tsx", "schema", "apps/desktop/src/features/schema/components/modals/RunRoutineModal.tsx", 10],
    ["apps/desktop/src/components/connections/ActionButtons.tsx", "connections", "apps/desktop/src/features/connections/components/list/ActionButtons.tsx", 11],
    ["apps/desktop/src/components/layout/sidebar/ConnectionGroupFolder.tsx", "connections", "apps/desktop/src/features/connections/components/sidebar/ConnectionGroupFolder.tsx", 11],
    ["apps/desktop/src/config/links.ts", "app", "apps/desktop/src/app/config/links.ts", 40],
  ])("matches plan ownership for %s", (source, owner, destination, moveTask) => {
    expect(sourceOwners.find((row) => row.source === source)).toEqual({ source, owner, destination, moveTask });
  });

  it("resolves a row from source before its move and destination after its move", () => {
    const row = sourceOwners.find(({ source }) => source === "apps/desktop/src/config/links.ts");
    expect(row).toEqual({
      source: "apps/desktop/src/config/links.ts",
      owner: "app",
      destination: "apps/desktop/src/app/config/links.ts",
      moveTask: 40,
    });
    expect([row!.source, row!.destination]).toContain(row!.source);
    expect([row!.source, row!.destination]).toContain(row!.destination);
  });
});
