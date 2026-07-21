import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { access, chmod, mkdir, readFile, rename, rm } from "node:fs/promises";
import { get } from "node:https";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";

const version = "1.7.7";
const artifacts = {
  "darwin-x64": ["actionlint_1.7.7_darwin_amd64.tar.gz", "28e5de5a05fc558474f638323d736d822fff183d2d492f0aecb2b73cc44584f5"],
  "darwin-arm64": ["actionlint_1.7.7_darwin_arm64.tar.gz", "2693315b9093aeacb4ebd91a993fea54fc215057bf0da2659056b4bc033873db"],
  "linux-x64": ["actionlint_1.7.7_linux_amd64.tar.gz", "023070a287cd8cccd71515fedc843f1985bf96c436b7effaecce67290e7e0757"],
  "linux-arm64": ["actionlint_1.7.7_linux_arm64.tar.gz", "401942f9c24ed71e4fe71b76c7d638f66d8633575c4016efd2977ce7c28317d0"],
  "win32-x64": ["actionlint_1.7.7_windows_amd64.zip", "7f12f1801bca3d480d67aaf7774f4c2a6359a3ca8eebe382c95c10c9704aa731"],
  "win32-arm64": ["actionlint_1.7.7_windows_arm64.zip", "76e9514cfac18e5677aa04f3a89873c981f16a2f2353bb97372a86cd09b1f5a8"],
};

const key = `${process.platform}-${process.arch}`;
const artifact = artifacts[key];
if (!artifact) throw new Error(`actionlint ${version} is unsupported on ${key}`);

const [archiveName, expectedSha256] = artifact;
const cacheDir = join(tmpdir(), "nexora-actionlint", version, key);
const binary = join(cacheDir, process.platform === "win32" ? "actionlint.exe" : "actionlint");
const temporaryArchive = join(tmpdir(), `${archiveName}.${process.pid}.tmp`);
const allowedRedirectHosts = new Set(["github.com", "release-assets.githubusercontent.com"]);

const download = async (url, destination, redirects = 0) => {
  if (redirects > 5) throw new Error("too many actionlint download redirects");
  if (url.protocol !== "https:" || !allowedRedirectHosts.has(url.hostname)) {
    throw new Error(`refusing actionlint download redirect to ${url.href}`);
  }
  const response = await new Promise((resolve, reject) => {
    const request = get(url, resolve);
    request.on("error", reject);
  });
  if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
    response.resume();
    return download(new URL(response.headers.location, url), destination, redirects + 1);
  }
  if (response.statusCode !== 200) {
    response.resume();
    throw new Error(`actionlint download failed with HTTP ${response.statusCode}`);
  }
  await pipeline(response, createWriteStream(destination, { flags: "wx" }));
};

const pathExists = async (path) => access(path).then(() => true, () => false);

const run = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) reject(new Error(`${command} terminated by ${signal}`));
      else if (code === 0) resolve();
      else reject(new Error(`${command} exited with status ${code}`));
    });
  });

await mkdir(cacheDir, { recursive: true });
if (!(await pathExists(binary))) {
  const stagingDir = `${cacheDir}.staging-${process.pid}`;
  const stagedArchive = join(stagingDir, archiveName);
  const stagedBinary = join(stagingDir, process.platform === "win32" ? "actionlint.exe" : "actionlint");
  await rm(stagingDir, { recursive: true, force: true });
  await mkdir(stagingDir, { recursive: true });
  await rm(temporaryArchive, { force: true });
  const url = new URL(`https://github.com/rhysd/actionlint/releases/download/v${version}/${archiveName}`);
  try {
    await download(url, temporaryArchive);
    const actualSha256 = createHash("sha256").update(await readFile(temporaryArchive)).digest("hex");
    if (actualSha256 !== expectedSha256) {
      throw new Error(`actionlint checksum mismatch for ${basename(archiveName)}`);
    }
    await rename(temporaryArchive, stagedArchive);
    if (archiveName.endsWith(".zip")) {
      await run(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", "Expand-Archive -LiteralPath $env:ACTIONLINT_ARCHIVE -DestinationPath $env:ACTIONLINT_DESTINATION -Force"],
        { env: { ...process.env, ACTIONLINT_ARCHIVE: stagedArchive, ACTIONLINT_DESTINATION: stagingDir } },
      );
    } else {
      await run("tar", ["-xzf", stagedArchive, "-C", stagingDir]);
    }
    if (!(await pathExists(stagedBinary))) throw new Error(`actionlint archive did not contain ${basename(stagedBinary)}`);
    if (process.platform !== "win32") await chmod(stagedBinary, 0o755);
    try {
      await rename(stagedBinary, binary);
    } catch (error) {
      if (!(await pathExists(binary))) throw error;
    }
  } finally {
    await rm(temporaryArchive, { force: true });
    await rm(stagingDir, { recursive: true, force: true });
  }
}

const child = spawn(binary, process.argv.slice(2), { stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("error", (error) => {
  throw error;
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
