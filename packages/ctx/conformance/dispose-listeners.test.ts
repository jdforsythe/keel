// Spec: k.ctx Conformance, "Under a stub `window`, a real ctx's `dispose()` removes its `online` and `offline`
// listeners once each; a repeat removes nothing." Seed 1337 (no generated inputs).
// Each test pins the sentence for one mode or driver set named by the API paragraph of k.ctx.
import { createCtx } from "@keel/ctx";
import { afterEach, describe, expect, test, vi } from "vitest";

const SEED = 1337;

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubWindow(onLine = true) {
  const addEventListener = vi.fn();
  const removeEventListener = vi.fn();
  vi.stubGlobal("window", { addEventListener, removeEventListener });
  vi.stubGlobal("navigator", { onLine });
  return { addEventListener, removeEventListener };
}

describe("k.ctx: dispose removes the window listeners", () => {
  test("under a stub `window`, a real ctx's `dispose()` removes its `online` and `offline` listeners once each", () => {
    const win = stubWindow();
    const ctx = createCtx({ mode: "real", seed: SEED });
    const added = win.addEventListener.mock.calls.map((c) => [c[0], c[1]]);
    expect(added.map((c) => c[0]).sort()).toEqual(["offline", "online"]);
    ctx.dispose();
    expect(win.removeEventListener).toHaveBeenCalledTimes(2);
    const removed = win.removeEventListener.mock.calls.map((c) => [c[0], c[1]]);
    expect(removed.map((c) => c[0]).sort()).toEqual(["offline", "online"]);
    for (const [type, fn] of removed) {
      expect(added.some(([t, f]) => t === type && f === fn)).toBe(true);
    }
  });

  test("a repeat `dispose()` of a real ctx removes nothing", () => {
    const win = stubWindow();
    const ctx = createCtx({ mode: "real", seed: SEED });
    ctx.dispose();
    const before = win.removeEventListener.mock.calls.length;
    ctx.dispose();
    ctx.dispose();
    expect(win.removeEventListener).toHaveBeenCalledTimes(before);
    expect(win.addEventListener).toHaveBeenCalledTimes(2);
  });

  test("under a stub `window`, a shell ctx's `dispose()` removes its `online` and `offline` listeners once each; a repeat removes nothing", () => {
    const win = stubWindow();
    const ctx = createCtx({ mode: "shell", seed: SEED });
    const added = win.addEventListener.mock.calls.map((c) => [c[0], c[1]]);
    ctx.dispose();
    expect(win.removeEventListener).toHaveBeenCalledTimes(2);
    const removed = win.removeEventListener.mock.calls.map((c) => [c[0], c[1]]);
    expect(removed.map((c) => c[0]).sort()).toEqual(["offline", "online"]);
    for (const [type, fn] of removed) {
      expect(added.some(([t, f]) => t === type && f === fn)).toBe(true);
    }
    ctx.dispose();
    expect(win.removeEventListener).toHaveBeenCalledTimes(2);
  });

  test("a sim ctx's `dispose()` removes no window listener", () => {
    const win = stubWindow();
    const ctx = createCtx({ mode: "sim", seed: SEED });
    ctx.dispose();
    ctx.dispose();
    expect(win.addEventListener).not.toHaveBeenCalled();
    expect(win.removeEventListener).not.toHaveBeenCalled();
  });

  test("a ctx whose net came from `drivers` has a `dispose()` that removes no window listener", () => {
    const win = stubWindow();
    const net = { fetch: () => Promise.reject(new TypeError("none")), online: () => true };
    for (const mode of ["real", "shell"] as const) {
      const ctx = createCtx({ mode, seed: SEED, drivers: { net } });
      ctx.dispose();
      ctx.dispose();
    }
    expect(win.removeEventListener).not.toHaveBeenCalled();
  });

  test("after `dispose()`, `ctx.net.online()` still returns `navigator.onLine`", () => {
    const nav = { onLine: true };
    vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
    vi.stubGlobal("navigator", nav);
    const ctx = createCtx({ mode: "real", seed: SEED });
    ctx.dispose();
    for (const onLine of [false, true, false]) {
      nav.onLine = onLine;
      expect(ctx.net.online()).toBe(onLine);
    }
  });
});
