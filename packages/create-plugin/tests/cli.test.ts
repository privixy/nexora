import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const cli = resolve(root, "src/cli.ts");
const packageVersion = (JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as { version: string }).version;

function run(args: string[]): { output: string; status: number } {
  try {
    return { output: execFileSync(process.execPath, ["--import", "tsx", cli, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }), status: 0 };
  } catch (error) {
    const result = error as { status?: number; stdout?: Buffer; stderr?: Buffer };
    return { output: `${result.stdout?.toString() ?? ""}${result.stderr?.toString() ?? ""}`, status: result.status ?? 1 };
  }
}

describe("CLI contract", () => {
  it("reports the current package version", () => {
    expect(run(["--version"])).toEqual({ output: `${packageVersion}\n`, status: 0 });
    expect(run(["-v"])).toEqual({ output: `${packageVersion}\n`, status: 0 });
  });

  it("preserves help and invalid-input exit behavior", () => {
    expect(run(["--help"]).status).toBe(0);
    expect(run([]).status).toBe(1);
    expect(run(["!"]).status).toBe(1);
    expect(run(["demo", "--db-type=invalid"]).status).toBe(1);
    expect(run(["demo", "--quote=invalid"]).status).toBe(1);
    expect(run(["--unknown"]).status).toBe(1);
  });

  it("rejects UI scaffolding for non-network plugins", () => {
    for (const kind of ["file", "folder", "api"]) {
      const root = mkdtempSync(join(tmpdir(), "create-plugin-cli-"));
      const result = run(["demo", `--db-type=${kind}`, "--with-ui", `--dir=${join(root, "demo")}`]);
      expect(result.status).toBe(1);
      expect(result.output).toContain("--with-ui requires --db-type=network");
      rmSync(root, { recursive: true, force: true });
    }
  });
});
