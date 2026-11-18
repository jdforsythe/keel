// Spec: k.owner, Conformance "`Ctx` and `SimCtx` have no `dispose` (type-level: `// @ts-expect-error` on `ctx.dispose()`), and `'dispose' in ctx` is false for a real, shell and sim ctx."
// Spec: k.owner, Owners "The generated resume, client and shell entries make the page ctx with no `signal`: it lives as long as the page. A server's ctx (`createApp`, `keel dev`, `server.mjs`) has no window and takes none. `@keel/std-sessions`' real and shell sinks make a ctx only for `random`, with `AbortSignal.abort()`, so it adds no listener. A test making real ctxs under one window passes a `signal` and aborts it when done. An object literal typed `Ctx` (a test's wrapper) lists `clock`, `random`, `net` and `storage`."
// Seed 1337 (the property below). The type-level clauses are `// @ts-expect-error` lines: the package's type check
// fails on an unused one, and the functions holding them are never called.
import { type Ctx, type SimCtx, createCtx } from "@keel/ctx";
import fc from "fast-check";
import { afterEach, describe, expect, expectTypeOf, test, vi } from "vitest";
import { StubWindow } from "./window-stub.ts";

const SEED = 1337;
const MODES = ["real", "shell", "sim"] as const;

afterEach(() => {
  vi.unstubAllGlobals();
});

function dispose(ctx: Ctx, sim: SimCtx): void {
  // @ts-expect-error `Ctx` has no `dispose`
  ctx.dispose();
  // @ts-expect-error `SimCtx` has no `dispose`
  sim.dispose();
}

/** Every own and inherited property name reachable from `root` through object-valued members, to a depth of 3. */
function reachableNames(root: object, depth = 3, seen = new Set<object>()): string[] {
  if (seen.has(root)) return [];
  seen.add(root);
  const names: string[] = [];
  for (let o: object | null = root; o !== null && o !== Object.prototype; o = Object.getPrototypeOf(o)) {
    for (const key of Object.getOwnPropertyNames(o)) {
      names.push(key);
      const desc = Object.getOwnPropertyDescriptor(o, key);
      const value: unknown = desc?.value;
      if (depth > 0 && typeof value === "object" && value !== null)
        names.push(...reachableNames(value, depth - 1, seen));
    }
  }
  return names;
}

describe("k.owner: `Ctx` and `SimCtx` have no `dispose`", () => {
  test("`Ctx` has no `dispose` member at the type level: `ctx.dispose()` is a type error", () => {
    expect(typeof dispose).toBe("function");
    expectTypeOf<Ctx>().not.toHaveProperty("dispose");
  });

  test("`SimCtx` has no `dispose` member at the type level: `sim.dispose()` is a type error", () => {
    expectTypeOf<SimCtx>().not.toHaveProperty("dispose");
  });

  test("`'dispose' in ctx` is false for a real, shell and sim ctx", () => {
    vi.stubGlobal("window", new StubWindow());
    vi.stubGlobal("navigator", { onLine: true });
    for (const mode of MODES) {
      const ctx = createCtx({ mode, seed: SEED });
      expect("dispose" in ctx).toBe(false);
      expect(Reflect.has(ctx, "dispose")).toBe(false);
      expect(ctx).not.toHaveProperty("dispose");
    }
  });

  test("`'dispose' in ctx` is false when the ctx is made with a `signal`, aborted or not", () => {
    vi.stubGlobal("window", new StubWindow());
    vi.stubGlobal("navigator", { onLine: true });
    for (const mode of MODES) {
      for (const signal of [new AbortController().signal, AbortSignal.abort()]) {
        const ctx = createCtx({ mode, seed: SEED, signal });
        expect("dispose" in ctx).toBe(false);
        expect(Object.getOwnPropertyNames(ctx)).not.toContain("dispose");
      }
    }
  });

  test("for any seed and mode, no property named `dispose` is reachable from a ctx", () => {
    vi.stubGlobal("window", new StubWindow());
    vi.stubGlobal("navigator", { onLine: true });
    fc.assert(
      fc.property(fc.constantFrom(...MODES), fc.integer({ min: 0, max: 2 ** 31 - 1 }), (mode, seed) => {
        const names = reachableNames(createCtx({ mode, seed }));
        expect(names).not.toContain("dispose");
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  test("nothing reachable from a ctx is named like an ending: `close`, `destroy`, `teardown`, `abort`, `stop`, `unsubscribe`", () => {
    vi.stubGlobal("window", new StubWindow());
    vi.stubGlobal("navigator", { onLine: true });
    const endings = ["dispose", "close", "destroy", "teardown", "abort", "stop", "unsubscribe", "signal", "controller"];
    for (const mode of MODES) {
      const names = reachableNames(createCtx({ mode, seed: SEED, signal: new AbortController().signal }));
      expect(names.filter((n) => endings.includes(n))).toEqual([]);
    }
  });
});

describe("k.owner: an object literal typed `Ctx` lists `clock`, `random`, `net` and `storage`", () => {
  test("a `Ctx` literal with exactly `clock`, `random`, `net` and `storage` type-checks, and works as a ctx", () => {
    const real = createCtx({ mode: "sim", seed: SEED });
    const wrapper: Ctx = { clock: real.clock, random: real.random, net: real.net, storage: real.storage };
    expect(Object.keys(wrapper).sort()).toEqual(["clock", "net", "random", "storage"]);
    expect(wrapper.clock.now()).toBe(real.clock.now());
  });

  test("a `SimCtx`-typed value is accepted where a `Ctx` is wanted, with no `dispose` added", () => {
    const sim: SimCtx = createCtx({ mode: "sim", seed: SEED });
    const asCtx: Ctx = sim;
    expect("dispose" in asCtx).toBe(false);
  });
});
