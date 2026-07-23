import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertHostCompat,
  defineSlot,
  getHost,
  openUrl,
  usePluginConnection,
  usePluginModal,
  usePluginQuery,
  usePluginSetting,
  usePluginTheme,
  usePluginToast,
  usePluginTranslation,
} from "../src/index";

const HOST_ERROR =
  "[@nexora/plugin-api] Host API not found. This bundle is designed to run inside Nexora — the host injects window.__NEXORA_API__ at load time. If you are testing locally, run the component inside Nexora as described in the plugin guide.";

afterEach(() => {
  delete (globalThis as { __NEXORA_API__?: unknown }).__NEXORA_API__;
  delete (globalThis as { __NEXORA_API_VERSION__?: string }).__NEXORA_API_VERSION__;
});

describe("plugin API runtime contract", () => {
  it("preserves the missing-host error", () => {
    expect(() => getHost()).toThrowError(HOST_ERROR);
  });

  it("delegates every helper to the injected host", async () => {
    const host = {
      usePluginQuery: vi.fn(() => ({ executeQuery: vi.fn(), loading: false, error: null })),
      usePluginConnection: vi.fn(() => ({ connectionId: "c", database: "d", schema: "s", driver: "x" })),
      usePluginToast: vi.fn(() => ({ showInfo: vi.fn(), showWarning: vi.fn(), showError: vi.fn() })),
      usePluginSetting: vi.fn(() => ({ value: "v", setValue: vi.fn(), loading: false })),
      usePluginTranslation: vi.fn(() => (key: string) => key),
      usePluginModal: vi.fn(() => ({ openModal: vi.fn(), closeModal: vi.fn() })),
      usePluginTheme: vi.fn(() => ({ theme: "dark" as const, colors: {} as never })),
      openUrl: vi.fn(async () => undefined),
    };
    (globalThis as { __NEXORA_API__?: unknown }).__NEXORA_API__ = host;

    expect(usePluginQuery()).toBe(host.usePluginQuery.mock.results[0]?.value);
    expect(usePluginConnection()).toBe(host.usePluginConnection.mock.results[0]?.value);
    expect(usePluginToast()).toBe(host.usePluginToast.mock.results[0]?.value);
    expect(usePluginSetting("demo")).toBe(host.usePluginSetting.mock.results[0]?.value);
    expect(usePluginTranslation("demo")("key")).toBe("key");
    expect(usePluginModal()).toBe(host.usePluginModal.mock.results[0]?.value);
    expect(usePluginTheme()).toBe(host.usePluginTheme.mock.results[0]?.value);
    await openUrl("https://example.com");

    expect(host.usePluginSetting).toHaveBeenCalledWith("demo");
    expect(host.usePluginTranslation).toHaveBeenCalledWith("demo");
    expect(host.openUrl).toHaveBeenCalledWith("https://example.com");
  });

  it("preserves version comparison behavior", () => {
    (globalThis as { __NEXORA_API_VERSION__?: string }).__NEXORA_API_VERSION__ = "0.1.0";
    expect(() => assertHostCompat("0.1.0")).not.toThrow();
    expect(() => assertHostCompat("0.0.9")).not.toThrow();
    expect(() => assertHostCompat("0.1.1")).toThrowError(
      "[@nexora/plugin-api] Host version 0.1.0 is older than required 0.1.1. Please update Nexora.",
    );
    expect(() => assertHostCompat("garbage")).not.toThrow();
  });

  it("preserves the older-host error", () => {
    expect(() => assertHostCompat("0.1.0")).toThrowError(
      "[@nexora/plugin-api] Host version 0.0.0 is older than required 0.1.0. Please update Nexora.",
    );
  });

  it("preserves typed slot runtime tagging", () => {
    const component = () => null;
    expect(defineSlot("sidebar.footer.actions", component)).toEqual({
      __slot: "sidebar.footer.actions",
      component,
    });
  });
});
