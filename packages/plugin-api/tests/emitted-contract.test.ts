import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { extractPublicContract, type PublicContract } from "../scripts/public-contract";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baseline = JSON.parse(readFileSync(resolve(root, "contracts/public-contract-baseline.json"), "utf8")) as {
  emittedContract: PublicContract | null;
  publishedContract: PublicContract | null;
};

describe("canonical public contract evidence", () => {
  it("records and verifies the staged build declaration contract", () => {
    expect(baseline.emittedContract).not.toBeNull();
    expect(extractPublicContract(resolve(root, ".tmp/build/index.d.ts"))).toEqual(baseline.emittedContract);
  });

  it("records a non-null canonical packed/public contract", () => {
    expect(baseline.publishedContract).not.toBeNull();
    expect(baseline.publishedContract).toEqual(baseline.emittedContract);
  });
});
