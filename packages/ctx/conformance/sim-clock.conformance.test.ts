// k.ctx: sim clock is controllable and monotonic
import { describe, expect, test } from "vitest";
import fc from "fast-check";
import { createCtx } from "@keel/ctx";

const SEED = 1337;

function simClock() {
  const clock = createCtx({ mode: "sim", seed: SEED }).clock;
  if (!("advance" in clock)) throw new Error("sim clock missing advance");
  return clock;
}

describe("k.ctx sim clock", () => {
  test("now() starts at 0", () => {
    expect(simClock().now()).toBe(0);
  });

  test("advance(ms) moves now() forward by exactly ms", () => {
    const c = simClock();
    c.advance(250);
    expect(c.now()).toBe(250);
    c.advance(50);
    expect(c.now()).toBe(300);
  });

  test("property: now() is monotonic non-decreasing under any advances", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 10_000 })), (steps) => {
        const c = simClock();
        let prev = c.now();
        for (const s of steps) {
          c.advance(s);
          const cur = c.now();
          expect(cur).toBeGreaterThanOrEqual(prev);
          prev = cur;
        }
        expect(prev).toBe(steps.reduce((a, b) => a + b, 0));
      }),
      { seed: 1337 },
    );
  });

  test("now() without advance does not move", () => {
    const c = simClock();
    expect(c.now()).toBe(c.now());
  });
});
