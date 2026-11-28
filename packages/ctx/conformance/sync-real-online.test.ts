// Spec: k.sync, clause "Under real with no global `navigator`, `online()` is true."
// Seed 1337 (no generated inputs). Node 22 defines a global `navigator`, so the test stubs it away with vi.stubGlobal.
// Untestable here: "updated on the window's `online` and `offline` events" needs a real window; the last test only
// stubs a minimal `window`/`navigator` pair and passes also for an implementation that reads `navigator.onLine` directly.
import { createCtx } from "@keel/ctx";
import { afterEach, describe, expect, test, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("k.sync: real connectivity", () => {
  test("Under real with no global `navigator`, `online()` is true", () => {
    vi.stubGlobal("navigator", undefined);
    expect(typeof navigator).toBe("undefined");
    const ctx = createCtx({ mode: "real", seed: 1337 });
    expect(ctx.net.online()).toBe(true);
  });

  test("under real with a global `navigator`, `online()` is `navigator.onLine`", () => {
    for (const onLine of [true, false]) {
      vi.stubGlobal("navigator", { onLine });
      const ctx = createCtx({ mode: "real", seed: 1337 });
      expect(ctx.net.online()).toBe(onLine);
    }
  });

  test("under shell with no global `navigator`, `online()` is true", () => {
    vi.stubGlobal("navigator", undefined);
    const ctx = createCtx({ mode: "shell", seed: 1337 });
    expect(ctx.net.online()).toBe(true);
  });

  test("under real, `online()` follows the window's `offline` and `online` events", () => {
    const nav = { onLine: true };
    const win = new EventTarget();
    vi.stubGlobal("navigator", nav);
    vi.stubGlobal("window", win);
    const ctx = createCtx({ mode: "real", seed: 1337 });
    expect(ctx.net.online()).toBe(true);
    nav.onLine = false;
    win.dispatchEvent(new Event("offline"));
    expect(ctx.net.online()).toBe(false);
    nav.onLine = true;
    win.dispatchEvent(new Event("online"));
    expect(ctx.net.online()).toBe(true);
  });
});
