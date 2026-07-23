import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type ManifestFixtureName = "minimal-driver" | "full-driver" | "ui-only" | "aliases" | "unknown-capability" | "unknown-slot";

export function loadManifestFixture(name: ManifestFixtureName): unknown {
  return JSON.parse(readFileSync(resolve(process.cwd(), `plugins/fixtures/manifests/${name}.json`), "utf8"));
}
