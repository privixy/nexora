import { beforeEach, describe, expect, it, vi } from "vitest";
import { convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir, join } from "@tauri-apps/api/path";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { openUrl } from "@tauri-apps/plugin-opener";
import { check } from "@tauri-apps/plugin-updater";
import {
  assetAdapter,
  clipboardAdapter,
  notificationAdapter,
  openerAdapter,
  pathAdapter,
  updaterAdapter,
} from "../../../src/platform/tauri";

vi.mock("@tauri-apps/api/core", () => ({ convertFileSrc: vi.fn() }));
vi.mock("@tauri-apps/api/path", () => ({ appDataDir: vi.fn(), join: vi.fn() }));
vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({ readText: vi.fn(), writeText: vi.fn() }));
vi.mock("@tauri-apps/plugin-notification", () => ({
  isPermissionGranted: vi.fn(),
  requestPermission: vi.fn(),
  sendNotification: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
vi.mock("@tauri-apps/plugin-updater", () => ({ check: vi.fn() }));

describe("Tauri platform adapters", () => {
  beforeEach(() => vi.clearAllMocks());

  it("forwards opener, notification, and clipboard calls", async () => {
    await openerAdapter.openUrl("https://example.com");
    expect(openUrl).toHaveBeenCalledWith("https://example.com");
    await notificationAdapter.isPermissionGranted();
    await notificationAdapter.requestPermission();
    const options = { title: "Title", body: "Body" };
    notificationAdapter.sendNotification(options);
    expect(isPermissionGranted).toHaveBeenCalledWith();
    expect(requestPermission).toHaveBeenCalledWith();
    expect(sendNotification).toHaveBeenCalledWith(options);
    await clipboardAdapter.readText();
    await clipboardAdapter.writeText("value");
    expect(readText).toHaveBeenCalledWith();
    expect(writeText).toHaveBeenCalledWith("value");
  });

  it("forwards updater options and returns the downloaded update", async () => {
    const update = { download: vi.fn(), install: vi.fn(), downloadAndInstall: vi.fn(), close: vi.fn() };
    const options = { timeout: 5_000 };
    vi.mocked(check).mockResolvedValue(update as never);
    expect(await updaterAdapter.check(options)).toBe(update);
    expect(check).toHaveBeenCalledWith(options);
  });

  it("preserves path argument order and rejection identity", async () => {
    vi.mocked(appDataDir).mockResolvedValue("/data");
    vi.mocked(join).mockResolvedValue("/data/a/b");
    expect(await pathAdapter.appDataDir()).toBe("/data");
    expect(await pathAdapter.join("/data", "a", "b")).toBe("/data/a/b");
    expect(join).toHaveBeenCalledWith("/data", "a", "b");
    const sentinel = { sentinel: true };
    vi.mocked(join).mockRejectedValue(sentinel);
    await expect(pathAdapter.join("a", "b")).rejects.toBe(sentinel);
  });

  it("preserves omitted asset protocols versus explicit protocols", () => {
    vi.mocked(convertFileSrc).mockReturnValue("asset");
    assetAdapter.convertFileSrc("/tmp/file");
    expect(convertFileSrc).toHaveBeenCalledWith("/tmp/file");
    assetAdapter.convertFileSrc("/tmp/file", "https");
    expect(convertFileSrc).toHaveBeenCalledWith("/tmp/file", "https");
  });
});
