// Seed 1337. `ctx.dispose()` removes the window listeners a real or shell ctx's own net added (k.ctx API).
import fc from "fast-check";
import { afterEach, expect, test, vi } from "vitest";
import type { Ctx } from "../src/Ctx.ts";
import type { CtxEvent } from "../src/CtxEvent.ts";
import type { Mode } from "../src/Mode.ts";
import { createCtx } from "../src/createCtx.ts";
import { observe } from "../src/observe.ts";

const SEED = 1337;

afterEach(() => vi.unstubAllGlobals());

/** A stub window that keeps the listeners currently attached and counts every add and remove. */
function stubWindow() {
  const live = {
    online: new Set<EventListenerOrEventListenerObject>(),
    offline: new Set<EventListenerOrEventListenerObject>(),
  };
  const counts = { added: 0, removed: 0 };
  const win = new EventTarget();
  const add = win.addEventListener.bind(win);
  const remove = win.removeEventListener.bind(win);
  vi.stubGlobal("window", {
    addEventListener(type: string, fn: EventListenerOrEventListenerObject) {
      counts.added++;
      if (type === "online" || type === "offline") live[type].add(fn);
      add(type, fn);
    },
    removeEventListener(type: string, fn: EventListenerOrEventListenerObject) {
      counts.removed++;
      if (type === "online" || type === "offline") live[type].delete(fn);
      remove(type, fn);
    },
    dispatchEvent: (e: Event) => win.dispatchEvent(e),
  });
  return { counts, live, fire: (type: string) => win.dispatchEvent(new Event(type)) };
}

type Step =
  | { readonly op: "create"; readonly mode: Mode; readonly driver: boolean }
  | { readonly op: "dispose"; readonly at: number };

const step: fc.Arbitrary<Step> = fc.oneof(
  fc.record({
    op: fc.constant("create" as const),
    mode: fc.constantFrom<Mode>("real", "shell", "sim"),
    driver: fc.boolean(),
  }),
  fc.record({ op: fc.constant("dispose" as const), at: fc.nat({ max: 40 }) }),
);

test("over any sequence of creates and disposes, listeners added minus removed is two per undisposed own-net ctx, never negative", () => {
  fc.assert(
    fc.property(fc.array(step, { maxLength: 40 }), (steps) => {
      vi.unstubAllGlobals();
      const win = stubWindow();
      vi.stubGlobal("navigator", { onLine: true });
      const net = { fetch: () => Promise.reject(new TypeError("none")), online: () => true };
      const made: { readonly ctx: Ctx; readonly holds: boolean; disposed: boolean }[] = [];
      for (const s of steps) {
        if (s.op === "create") {
          const driven = s.driver && s.mode !== "sim";
          made.push({
            ctx: createCtx(driven ? { mode: s.mode, seed: SEED, drivers: { net } } : { mode: s.mode, seed: SEED }),
            holds: s.mode !== "sim" && !driven,
            disposed: false,
          });
        } else {
          const entry = made[s.at % Math.max(made.length, 1)];
          if (entry === undefined) continue;
          entry.ctx.dispose();
          entry.disposed = true;
        }
        const live = made.filter((m) => m.holds && !m.disposed).length;
        expect(win.counts.added - win.counts.removed).toBe(2 * live);
        expect(win.live.online.size + win.live.offline.size).toBe(2 * live);
      }
    }),
    { seed: SEED },
  );
});

test("a disposed real ctx reports no further net event, and stays usable", async () => {
  const win = stubWindow();
  const nav = { onLine: true };
  vi.stubGlobal("navigator", nav);
  const ctx = createCtx({ mode: "real", seed: SEED });
  const seen: CtxEvent[] = [];
  observe(ctx, (e) => {
    if (e.kind === "net") seen.push(e);
  });
  nav.onLine = false;
  win.fire("offline");
  expect(seen).toEqual([{ kind: "net", online: false }]);
  ctx.dispose();
  nav.onLine = true;
  win.fire("online");
  expect(seen).toEqual([{ kind: "net", online: false }]);
  expect(ctx.net.online()).toBe(true);
  expect(ctx.random.id("Thing")).toMatch(/^[0-9a-f-]{36}$/);
  await ctx.clock.after(0);
});

test("without a window, dispose does nothing and a repeat does nothing", () => {
  vi.stubGlobal("window", undefined);
  const ctx = createCtx({ mode: "real", seed: SEED });
  expect(() => {
    ctx.dispose();
    ctx.dispose();
  }).not.toThrow();
  expect(Object.isFrozen(ctx)).toBe(true);
  expect(Object.keys(ctx).sort()).toEqual(["clock", "dispose", "net", "random", "storage"]);
});
