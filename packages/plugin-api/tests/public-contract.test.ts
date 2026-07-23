import { describe, expect, it } from "vitest";
import {
  comparePublicContracts,
  formatSyncFailure,
  type ContractBaseline,
  type PublicContract,
} from "../scripts/public-contract";

const symbol = { kind: "value" as const, declaration: "():string" };
const baseline: ContractBaseline = {
  differences: [{ key: "known", expected: symbol, actual: null, reason: "reason", owner: "owner", removeWhen: "condition" }],
  allowlist: [],
};

function contract(symbols: PublicContract["symbols"], version = "0.1.0"): PublicContract {
  return { symbols, version };
}

describe("public contract comparison", () => {
  it("accepts unchanged baselined drift", () => {
    expect(comparePublicContracts(contract({ known: symbol }), contract({}), baseline)).toEqual({
      newDrift: [], changedDrift: [], resolvedDrift: [], staleAllowlistEntries: [], versionMismatches: [],
    });
  });

  it("classifies new, changed, resolved, stale allowlist, and version drift", () => {
    expect(comparePublicContracts(contract({ new: symbol }, "0.2.0"), contract({ new: { ...symbol, declaration: "():number" } }), {
      differences: [{ ...baseline.differences[0]!, actual: symbol }],
      allowlist: [{ key: "gone", reason: "reason", owner: "owner", removeWhen: "condition" }],
    })).toEqual({
      newDrift: [{ key: "new", expected: symbol, actual: { ...symbol, declaration: "():number" } }],
      changedDrift: [],
      resolvedDrift: [{ ...baseline.differences[0]!, actual: symbol }],
      staleAllowlistEntries: ["gone"],
      versionMismatches: ["hostApiVersion=0.2.0 does not match pluginApiVersion=0.1.0"],
    });
  });

  it("formats actionable diagnostics", () => {
    expect(formatSyncFailure({
      newDrift: [{ key: "demo", expected: symbol, actual: null }], changedDrift: [], resolvedDrift: [], staleAllowlistEntries: [], versionMismatches: [],
    })).toContain("newDrift: demo");
  });
});
