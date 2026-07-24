import { beforeEach, describe, expect, it, vi } from "vitest";
import { emit, listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { emitTauri, invokeTauri, listenTauri } from "../../../src/platform/tauri";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ emit: vi.fn(), listen: vi.fn() }));

describe("Tauri transport", () => {
  beforeEach(() => vi.clearAllMocks());

  it("preserves omitted, undefined, and null payloads", async () => {
    vi.mocked(invoke).mockResolvedValue("ok");

    await invokeTauri<string>("without_payload");
    expect(invoke).toHaveBeenCalledWith("without_payload");
    await invokeTauri<string>("explicit_undefined", { schema: undefined });
    expect(invoke).toHaveBeenCalledWith("explicit_undefined", { schema: undefined });
    await invokeTauri<string>("explicit_null", { connectionId: null });
    expect(invoke).toHaveBeenCalledWith("explicit_null", { connectionId: null });
  });

  it("preserves rejection identity", async () => {
    const sentinel = { sentinel: true };
    vi.mocked(invoke).mockRejectedValue(sentinel);
    await expect(invokeTauri("fails")).rejects.toBe(sentinel);
  });

  it("unwraps event payloads and returns the exact cleanup function", async () => {
    const unlisten = vi.fn();
    vi.mocked(listen).mockImplementation(async (_name, handler) => {
      handler({ payload: { value: 1 } } as never);
      return unlisten;
    });
    const handler = vi.fn();

    const cleanup = await listenTauri("event", handler);

    expect(handler).toHaveBeenCalledWith({ value: 1 });
    expect(cleanup).toBe(unlisten);
  });

  it("forwards emit payloads exactly", async () => {
    const payload = { value: undefined };
    await emitTauri("event", payload);
    expect(emit).toHaveBeenCalledWith("event", payload);
  });
});
