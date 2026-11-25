// Spec: k.ctx, clause "Under a stub `window`, aborting the `signal` a real ctx was made with removes its `online` and `offline` listeners once each; a second abort removes nothing."
// Seed 1337 (no generated inputs). Each test pins the sentence for one mode or driver set named by the API paragraph of k.ctx.
// A stub `window` records live listeners, whether they end through `removeEventListener` or through the `signal` they
// were added with (./window-stub.ts).
import { createCtx } from "@keel/ctx";
import { afterEach, describe, expect, test, vi } from "vitest";
import { StubWindow, countOf } from "./window-stub.ts";

const SEED = 1337;

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubWindow(onLine = true) {
  const win = new StubWindow();
  vi.stubGlobal("window", win);
  vi.stubGlobal("navigator", { onLine });
  return win;
}

describe("k.ctx: aborting the signal removes the window listeners", () => {
  test("under a stub `window`, aborting the `signal` a real ctx was made with removes its `online` and `offline` listeners once each", () => {
    const win = stubWindow();
    const ac = new AbortController();
    createCtx({ mode: "real", seed: SEED, signal: ac.signal });
    expect(win.added.slice().sort()).toEqual(["offline", "online"]);
    expect(win.removed).toEqual([]);
    ac.abort();
    expect(countOf(win.removed, "online")).toBe(1);
    expect(countOf(win.removed, "offline")).toBe(1);
    expect(win.removed).toHaveLength(2);
    expect(win.total()).toBe(0);
  });

  test("a second abort of the `signal` of a real ctx removes nothing", () => {
    const win = stubWindow();
    const ac = new AbortController();
    createCtx({ mode: "real", seed: SEED, signal: ac.signal });
    ac.abort();
    const before = win.removed.length;
    ac.abort();
    ac.abort("again");
    expect(win.removed).toHaveLength(before);
    expect(win.added).toHaveLength(2);
  });

  test("under a stub `window`, aborting the `signal` a shell ctx was made with removes its `online` and `offline` listeners once each; a second abort removes nothing", () => {
    const win = stubWindow();
    const ac = new AbortController();
    createCtx({ mode: "shell", seed: SEED, signal: ac.signal });
    ac.abort();
    expect(win.removed.slice().sort()).toEqual(["offline", "online"]);
    ac.abort();
    expect(win.removed).toHaveLength(2);
  });

  test("a sim ctx made with a `signal` that aborts removes no window listener", () => {
    const win = stubWindow();
    const ac = new AbortController();
    createCtx({ mode: "sim", seed: SEED, signal: ac.signal });
    ac.abort();
    expect(win.added).toEqual([]);
    expect(win.removed).toEqual([]);
  });

  test("a ctx whose net came from `drivers` made with a `signal` that aborts removes no window listener", () => {
    const win = stubWindow();
    const net = { fetch: () => Promise.reject(new TypeError("none")), online: () => true };
    for (const mode of ["real", "shell"] as const) {
      const ac = new AbortController();
      createCtx({ mode, seed: SEED, drivers: { net }, signal: ac.signal });
      ac.abort();
    }
    expect(win.removed).toEqual([]);
  });

  test("after the abort, `ctx.net.online()` still returns `navigator.onLine`", () => {
    const nav = { onLine: true };
    vi.stubGlobal("window", new StubWindow());
    vi.stubGlobal("navigator", nav);
    const ac = new AbortController();
    const ctx = createCtx({ mode: "real", seed: SEED, signal: ac.signal });
    ac.abort();
    for (const onLine of [false, true, false]) {
      nav.onLine = onLine;
      expect(ctx.net.online()).toBe(onLine);
    }
  });
});
