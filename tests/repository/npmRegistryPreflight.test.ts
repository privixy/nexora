import { describe, expect, it, vi } from "vitest";
import { registryPreflight } from "../../scripts/npm-registry-preflight.mjs";

const specifier = "@nexora/plugin-api@0.1.0";

describe("npm registry preflight", () => {
  it("classifies exact presence", async () => {
    await expect(registryPreflight(specifier, { runner: async () => ({ error: null, stdout: '{"name":"@nexora/plugin-api","version":"0.1.0"}', stderr: "" }) })).resolves.toEqual({ status: "present", packageName: "@nexora/plugin-api", version: "0.1.0" });
  });

  it("accepts only exact public-registry absence", async () => {
    const error = Object.assign(new Error("missing"), { code: 1 });
    await expect(registryPreflight(specifier, { runner: async () => ({ error, stdout: JSON.stringify({ error: { code: "E404", summary: "https://registry.npmjs.org/ '@nexora/plugin-api@0.1.0' absent" } }), stderr: "" }) })).resolves.toEqual({ status: "absent", packageName: "@nexora/plugin-api", version: "0.1.0" });
  });

  it.each(["E401", "E403", "E429"])("rejects %s", async (code) => {
    const error = new Error(code);
    await expect(registryPreflight(specifier, { runner: async () => ({ error, stdout: JSON.stringify({ error: { code } }), stderr: "" }) })).rejects.toThrow(code);
  });

  it("removes credentials and forces the public registry", async () => {
    process.env.NODE_AUTH_TOKEN = "redacted";
    const runner = vi.fn(async (_command, args, options) => {
      expect(args).toContain("--registry=https://registry.npmjs.org/");
      expect(options.env.NODE_AUTH_TOKEN).toBeUndefined();
      return { error: null, stdout: '{"name":"@nexora/plugin-api","version":"0.1.0"}', stderr: "" };
    });
    await registryPreflight(specifier, { runner });
    delete process.env.NODE_AUTH_TOKEN;
  });
});
