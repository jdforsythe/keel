// Spec: k.sim, Conformance "An `offline` window `{ at: 100, ms: 50 }` makes `ctx.net.online()` false from clock time 100 to 150, and an observer gets the two `net` events."
// Seed: 1337.
import type { CtxEvent } from "@keel/ctx";
import { createCtx, observe } from "@keel/ctx";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const SEED = 1337;

function make(offline: { at: number; ms: number }[]) {
  const ctx = createCtx({ mode: "sim", seed: SEED, schedule: { net: [], storage: [], offline, plans: {} } });
  const events: CtxEvent[] = [];
  observe(ctx, (e) => {
    events.push(e);
  });
  return { ctx, nets: () => events.filter((e) => e.kind === "net") };
}

describe("k.sim: offline window", () => {
  test("`ctx.net.online()` is true before clock time 100", () => {
    const { ctx } = make([{ at: 100, ms: 50 }]);
    expect(ctx.net.online()).toBe(true);
    ctx.clock.advance(99);
    expect(ctx.net.online()).toBe(true);
  });

  test("`ctx.net.online()` is false from clock time 100 to 150", () => {
    const { ctx } = make([{ at: 100, ms: 50 }]);
    ctx.clock.advance(100);
    expect(ctx.net.online()).toBe(false);
    ctx.clock.advance(49);
    expect(ctx.clock.now()).toBe(149);
    expect(ctx.net.online()).toBe(false);
  });

  test("`ctx.net.online()` is true again at clock time 150", () => {
    const { ctx } = make([{ at: 100, ms: 50 }]);
    ctx.clock.advance(150);
    expect(ctx.net.online()).toBe(true);
  });

  test("an observer gets the two `net` events", () => {
    const { ctx, nets } = make([{ at: 100, ms: 50 }]);
    ctx.clock.advance(99);
    expect(nets()).toEqual([]);
    ctx.clock.advance(1);
    expect(nets()).toEqual([{ kind: "net", online: false }]);
    ctx.clock.advance(50);
    expect(nets()).toEqual([
      { kind: "net", online: false },
      { kind: "net", online: true },
    ]);
  });

  test("property: online() is false exactly while the clock is inside a window of one separated window series", () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ gap: fc.integer({ min: 1, max: 100 }), ms: fc.integer({ min: 1, max: 100 }) }), {
          minLength: 1,
          maxLength: 5,
        }),
        fc.array(fc.integer({ min: 0, max: 80 }), { maxLength: 15 }),
        (parts, steps) => {
          let t = 0;
          const windows = parts.map(({ gap, ms }) => {
            const at = t + gap;
            t = at + ms;
            return { at, ms };
          });
          const { ctx } = make(windows);
          for (const step of steps) {
            ctx.clock.advance(step);
            const now = ctx.clock.now();
            const inside = windows.some((w) => now >= w.at && now < w.at + w.ms);
            expect(ctx.net.online()).toBe(!inside);
          }
        },
      ),
      { seed: SEED },
    );
  });
});
