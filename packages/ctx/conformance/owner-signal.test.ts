// k.owner, API "`createCtx({ ..., signal?: AbortSignal })`. A real or shell ctx whose net is its own adds its window `online` and `offline` listeners when made and removes each once when `signal` aborts; made with an aborted `signal`, it adds none. A sim ctx and a ctx whose net comes from `drivers` add none, and `signal` changes nothing on them. `Ctx` and `SimCtx` have no `dispose`, and nothing reachable from a ctx ends it: a holder that did not make the ctx gets its capabilities and no way to remove its listeners. The ctx stays usable after the abort."
// Spec: k.owner, clause "Under a stub `window`, a real ctx made with a `signal` adds one `online` and one `offline` listener; aborting the signal removes each once and a second abort removes nothing; made with `AbortSignal.abort()` it adds none. A shell ctx behaves the same."
// Spec: k.owner, clause "A sim ctx and a real ctx with a `drivers` net, each made with a `signal` aborted or not, add and remove no window listener."
// Spec: k.owner, clause "Before the abort a dispatched `online` reaches `observe` as one `net` event; after it, none; the ctx's `clock`, `random` and `storage` still work."
// Seed 1337 (the property below). A stub `window` is an EventTarget that records live listeners, whether they end
// through `removeEventListener` or through the `signal` they were added with (./window-stub.ts).
import { type CtxEvent, createCtx, observe } from "@keel/ctx";
import fc from "fast-check";
import { afterEach, describe, expect, test, vi } from "vitest";
import { StubWindow, countOf } from "./window-stub.ts";

const SEED = 1337;
const MODES = ["real", "shell"] as const;

afterEach(() => {
  vi.unstubAllGlobals();
});

function host(onLine = true) {
  const win = new StubWindow();
  const nav = { onLine };
  vi.stubGlobal("window", win);
  vi.stubGlobal("navigator", nav);
  return { win, nav };
}

const netEvents = (events: readonly CtxEvent[]) => events.filter((e) => e.kind === "net");

const memoryStorage = () => {
  const data = new Map<string, string>();
  return {
    get: (key: string) => Promise.resolve(data.get(key) ?? null),
    set: (key: string, value: string) => {
      data.set(key, value);
      return Promise.resolve();
    },
    read: (keys: readonly string[]) => Promise.resolve(keys.map((k) => data.get(k) ?? null)),
    commit: (writes: ReadonlyArray<{ key: string; expect: string | null; value?: string }>) => {
      if (writes.some((w) => (data.get(w.key) ?? null) !== w.expect)) return Promise.resolve(false);
      for (const w of writes) if (w.value !== undefined) data.set(w.key, w.value);
      return Promise.resolve(true);
    },
  };
};

describe("k.owner: a real or shell ctx's listeners end with the signal", () => {
  test("a real ctx made with a `signal` adds one `online` and one `offline` listener", () => {
    const { win } = host();
    const ac = new AbortController();
    createCtx({ mode: "real", seed: SEED, signal: ac.signal });
    expect(countOf(win.added, "online")).toBe(1);
    expect(countOf(win.added, "offline")).toBe(1);
    expect(win.count("online")).toBe(1);
    expect(win.count("offline")).toBe(1);
    expect(win.added).toHaveLength(2);
  });

  test("aborting the `signal` removes the `online` and `offline` listener once each", () => {
    const { win } = host();
    const ac = new AbortController();
    createCtx({ mode: "real", seed: SEED, signal: ac.signal });
    ac.abort();
    expect(countOf(win.removed, "online")).toBe(1);
    expect(countOf(win.removed, "offline")).toBe(1);
    expect(win.removed).toHaveLength(2);
    expect(win.total()).toBe(0);
  });

  test("a second abort removes nothing", () => {
    const { win } = host();
    const ac = new AbortController();
    createCtx({ mode: "real", seed: SEED, signal: ac.signal });
    ac.abort();
    ac.abort("again");
    expect(win.removed).toHaveLength(2);
    expect(win.added).toHaveLength(2);
  });

  test("made with `AbortSignal.abort()`, a real ctx adds no listener", () => {
    const { win } = host();
    createCtx({ mode: "real", seed: SEED, signal: AbortSignal.abort() });
    expect(win.added).toEqual([]);
    expect(win.removed).toEqual([]);
    expect(win.total()).toBe(0);
  });

  test("a shell ctx made with a `signal` adds one `online` and one `offline` listener, and aborting removes each once", () => {
    const { win } = host();
    const ac = new AbortController();
    createCtx({ mode: "shell", seed: SEED, signal: ac.signal });
    expect(countOf(win.added, "online")).toBe(1);
    expect(countOf(win.added, "offline")).toBe(1);
    ac.abort();
    ac.abort();
    expect(countOf(win.removed, "online")).toBe(1);
    expect(countOf(win.removed, "offline")).toBe(1);
    expect(win.removed).toHaveLength(2);
  });

  test("a shell ctx made with `AbortSignal.abort()` adds no listener", () => {
    const { win } = host();
    createCtx({ mode: "shell", seed: SEED, signal: AbortSignal.abort() });
    expect(win.added).toEqual([]);
    expect(win.removed).toEqual([]);
  });

  test("a real or shell ctx made with no `signal` adds its two listeners and removes none, however many events follow", () => {
    for (const mode of MODES) {
      const { win, nav } = host();
      createCtx({ mode, seed: SEED });
      expect(win.added).toHaveLength(2);
      for (let i = 0; i < 6; i++) {
        nav.onLine = i % 2 === 0;
        win.dispatchEvent(new Event(i % 2 === 0 ? "online" : "offline"));
      }
      expect(win.removed).toEqual([]);
      expect(win.total()).toBe(2);
      vi.unstubAllGlobals();
    }
  });

  test("any number of ctxs under one window: each signal's abort ends exactly its own two listeners", () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ mode: fc.constantFrom(...MODES), abort: fc.boolean() }), { minLength: 1, maxLength: 8 }),
        (specs) => {
          const { win } = host();
          const controllers = specs.map((s) => {
            const ac = new AbortController();
            createCtx({ mode: s.mode, seed: SEED, signal: ac.signal });
            return ac;
          });
          expect(win.total()).toBe(2 * specs.length);
          specs.forEach((s, i) => {
            if (s.abort) controllers[i]?.abort();
          });
          const kept = specs.filter((s) => !s.abort).length;
          expect(win.total()).toBe(2 * kept);
          expect(win.removed).toHaveLength(2 * (specs.length - kept));
          for (const ac of controllers) ac.abort();
          expect(win.total()).toBe(0);
          expect(win.removed).toHaveLength(2 * specs.length);
          vi.unstubAllGlobals();
        },
      ),
      { seed: SEED, numRuns: 50 },
    );
  });
});

describe("k.owner: a sim ctx and a ctx whose net comes from `drivers` ignore the signal", () => {
  const net = { fetch: () => Promise.reject(new TypeError("none")), online: () => true };

  test("a sim ctx made with a live `signal`, aborted or not, adds and removes no window listener", () => {
    const { win } = host();
    const ac = new AbortController();
    createCtx({ mode: "sim", seed: SEED, signal: ac.signal });
    expect(win.added).toEqual([]);
    ac.abort();
    ac.abort();
    expect(win.added).toEqual([]);
    expect(win.removed).toEqual([]);
  });

  test("a sim ctx made with `AbortSignal.abort()` adds and removes no window listener", () => {
    const { win } = host();
    createCtx({ mode: "sim", seed: SEED, signal: AbortSignal.abort() });
    expect(win.added).toEqual([]);
    expect(win.removed).toEqual([]);
  });

  test("a real or shell ctx with a `drivers` net made with a live `signal`, aborted or not, adds and removes no window listener", () => {
    for (const mode of MODES) {
      const { win } = host();
      const ac = new AbortController();
      createCtx({ mode, seed: SEED, drivers: { net }, signal: ac.signal });
      expect(win.added).toEqual([]);
      ac.abort();
      ac.abort();
      expect(win.added).toEqual([]);
      expect(win.removed).toEqual([]);
      vi.unstubAllGlobals();
    }
  });

  test("a real or shell ctx with a `drivers` net made with `AbortSignal.abort()` adds and removes no window listener", () => {
    for (const mode of MODES) {
      const { win } = host();
      createCtx({ mode, seed: SEED, drivers: { net }, signal: AbortSignal.abort() });
      expect(win.added).toEqual([]);
      expect(win.removed).toEqual([]);
      vi.unstubAllGlobals();
    }
  });

  test("a sim ctx and a drivers-net ctx made with no `signal` add no window listener", () => {
    const { win } = host();
    createCtx({ mode: "sim", seed: SEED });
    createCtx({ mode: "real", seed: SEED, drivers: { net } });
    expect(win.added).toEqual([]);
  });
});

describe("k.owner: before the abort a dispatched event reaches `observe`; after it, none", () => {
  test("before the abort a dispatched `online` reaches `observe` as one `net` event", () => {
    const { win, nav } = host(false);
    const ac = new AbortController();
    const ctx = createCtx({ mode: "real", seed: SEED, signal: ac.signal });
    const seen: CtxEvent[] = [];
    observe(ctx, (e) => void seen.push(e));
    nav.onLine = true;
    win.dispatchEvent(new Event("online"));
    expect(netEvents(seen)).toEqual([{ kind: "net", online: true }]);
  });

  test("before the abort a dispatched `offline` reaches `observe` as one `net` event", () => {
    const { win, nav } = host(true);
    const ac = new AbortController();
    const ctx = createCtx({ mode: "real", seed: SEED, signal: ac.signal });
    const seen: CtxEvent[] = [];
    observe(ctx, (e) => void seen.push(e));
    nav.onLine = false;
    win.dispatchEvent(new Event("offline"));
    expect(netEvents(seen)).toEqual([{ kind: "net", online: false }]);
  });

  test("after the abort a dispatched `online` or `offline` reaches `observe` as no `net` event, on a real and a shell ctx", () => {
    for (const mode of MODES) {
      const { win, nav } = host(true);
      const ac = new AbortController();
      const ctx = createCtx({ mode, seed: SEED, signal: ac.signal });
      const seen: CtxEvent[] = [];
      observe(ctx, (e) => void seen.push(e));
      ac.abort();
      nav.onLine = false;
      win.dispatchEvent(new Event("offline"));
      nav.onLine = true;
      win.dispatchEvent(new Event("online"));
      expect(netEvents(seen)).toEqual([]);
      vi.unstubAllGlobals();
    }
  });

  test("a ctx made with `AbortSignal.abort()` sees no `net` event from a dispatched event", () => {
    const { win, nav } = host(true);
    const ctx = createCtx({ mode: "real", seed: SEED, signal: AbortSignal.abort() });
    const seen: CtxEvent[] = [];
    observe(ctx, (e) => void seen.push(e));
    nav.onLine = false;
    win.dispatchEvent(new Event("offline"));
    expect(netEvents(seen)).toEqual([]);
  });

  test("aborting one ctx's signal leaves another ctx's `net` events flowing", () => {
    const { win, nav } = host(true);
    const a = new AbortController();
    const ctxA = createCtx({ mode: "real", seed: SEED, signal: a.signal });
    const ctxB = createCtx({ mode: "real", seed: SEED });
    const seenA: CtxEvent[] = [];
    const seenB: CtxEvent[] = [];
    observe(ctxA, (e) => void seenA.push(e));
    observe(ctxB, (e) => void seenB.push(e));
    a.abort();
    nav.onLine = false;
    win.dispatchEvent(new Event("offline"));
    expect(netEvents(seenA)).toEqual([]);
    expect(netEvents(seenB)).toEqual([{ kind: "net", online: false }]);
  });

  test("after the abort `clock.now()`, `random.float()` and `storage` still work, on a real and a shell ctx", async () => {
    for (const mode of MODES) {
      host();
      const ac = new AbortController();
      const ctx = createCtx({ mode, seed: SEED, signal: ac.signal, drivers: { storage: memoryStorage() } });
      ac.abort();
      expect(Number.isFinite(ctx.clock.now())).toBe(true);
      const f = ctx.random.float();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      await ctx.storage.set("k", "v");
      expect(await ctx.storage.get("k")).toBe("v");
      vi.unstubAllGlobals();
    }
  });

  test("after the abort `net.online()` still returns `navigator.onLine`", () => {
    const { nav } = host(true);
    const ac = new AbortController();
    const ctx = createCtx({ mode: "real", seed: SEED, signal: ac.signal });
    ac.abort();
    for (const onLine of [false, true, false]) {
      nav.onLine = onLine;
      expect(ctx.net.online()).toBe(onLine);
    }
  });
});
