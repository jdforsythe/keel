// Seed 1337. Aborting the `signal` a real or shell ctx was made with removes the window listeners its own net added.
import fc from "fast-check";
import { afterEach, expect, test, vi } from "vitest";
import type { Ctx } from "../src/Ctx.ts";
import type { CtxEvent } from "../src/CtxEvent.ts";
import type { Mode } from "../src/Mode.ts";
import { createCtx } from "../src/createCtx.ts";
import { observe } from "../src/observe.ts";

const SEED = 1337;

afterEach(() => vi.unstubAllGlobals());

/** A stub window that keeps the listeners currently live, whether they end by remove or by their signal. */
function stubWindow() {
  const live = new Set<string>();
  const win = new EventTarget();
  let next = 0;
  vi.stubGlobal("window", {
    addEventListener(type: string, fn: EventListenerOrEventListenerObject, options?: AddEventListenerOptions) {
      const signal = options?.signal;
      if (signal?.aborted === true) return;
      const key = `${type}:${next++}`;
      live.add(key);
      signal?.addEventListener("abort", () => live.delete(key), { once: true });
      win.addEventListener(type, fn, options);
    },
    removeEventListener: () => {},
    dispatchEvent: (e: Event) => win.dispatchEvent(e),
  });
  return { live, fire: (type: string) => win.dispatchEvent(new Event(type)) };
}

type Step =
  | { readonly op: "create"; readonly mode: Mode; readonly driver: boolean; readonly aborted: boolean }
  | { readonly op: "abort"; readonly at: number };

const step: fc.Arbitrary<Step> = fc.oneof(
  fc.record({
    op: fc.constant("create" as const),
    mode: fc.constantFrom<Mode>("real", "shell", "sim"),
    driver: fc.boolean(),
    aborted: fc.boolean(),
  }),
  fc.record({ op: fc.constant("abort" as const), at: fc.nat({ max: 40 }) }),
);

test("over any sequence of creates and aborts, two listeners are live per own-net ctx whose signal has not aborted", () => {
  fc.assert(
    fc.property(fc.array(step, { maxLength: 40 }), (steps) => {
      vi.unstubAllGlobals();
      const win = stubWindow();
      vi.stubGlobal("navigator", { onLine: true });
      const net = { fetch: () => Promise.reject(new TypeError("none")), online: () => true };
      const made: { readonly owner: AbortController; readonly holds: boolean }[] = [];
      for (const s of steps) {
        if (s.op === "create") {
          const driven = s.driver && s.mode !== "sim";
          const owner = new AbortController();
          if (s.aborted) owner.abort();
          const signal = owner.signal;
          createCtx(
            driven ? { mode: s.mode, seed: SEED, drivers: { net }, signal } : { mode: s.mode, seed: SEED, signal },
          );
          made.push({ owner, holds: s.mode !== "sim" && !driven });
        } else {
          made[s.at % Math.max(made.length, 1)]?.owner.abort();
        }
        const holding = made.filter((m) => m.holds && !m.owner.signal.aborted).length;
        expect(win.live.size).toBe(2 * holding);
      }
    }),
    { seed: SEED },
  );
});

test("after its signal aborts a real ctx reports no further net event, and stays usable", async () => {
  const win = stubWindow();
  const nav = { onLine: true };
  vi.stubGlobal("navigator", nav);
  const owner = new AbortController();
  const ctx: Ctx = createCtx({ mode: "real", seed: SEED, signal: owner.signal });
  const seen: CtxEvent[] = [];
  observe(ctx, (e) => {
    if (e.kind === "net") seen.push(e);
  });
  nav.onLine = false;
  win.fire("offline");
  expect(seen).toEqual([{ kind: "net", online: false }]);
  owner.abort();
  nav.onLine = true;
  win.fire("online");
  expect(seen).toEqual([{ kind: "net", online: false }]);
  expect(ctx.net.online()).toBe(true);
  expect(ctx.random.id("Thing")).toMatch(/^[0-9a-f-]{36}$/);
  await ctx.clock.after(0);
});

test("without a window, a signal's abort does nothing and the ctx has only its four capabilities", () => {
  vi.stubGlobal("window", undefined);
  const owner = new AbortController();
  const ctx = createCtx({ mode: "real", seed: SEED, signal: owner.signal });
  expect(() => owner.abort()).not.toThrow();
  expect(Object.isFrozen(ctx)).toBe(true);
  expect(Object.keys(ctx).sort()).toEqual(["clock", "net", "random", "storage"]);
});
