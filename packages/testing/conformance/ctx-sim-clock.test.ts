// @vitest-environment happy-dom
// Spec: k.testing, clause "Inside a harness render, `ctx.clock.now()` returns the sim clock's value, and two runs with one seed produce equal `state()`."
// Seed: 1337.
import { render } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CartView, ClockView, SEED, cart, simCtx } from "./fixtures.ts";

describe("k.testing: inside a harness render ctx.clock.now() returns the sim clock's value, and two runs with one seed produce equal state()", () => {
  it("a component reading ctx.clock.now() sees 0 at start", () => {
    const t = render(ClockView, { props: {}, ctx: simCtx() });
    expect(t.find("clock.now").text).toBe("0");
    t.dispose();
  });

  it("advancing the sim clock changes what the component reads", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 1_000_000 }), async (ms) => {
        const ctx = simCtx();
        const t = render(ClockView, { props: {}, ctx });
        ctx.clock.advance(ms);
        await t.fire("clock.read", { type: "click" });
        expect(t.find("clock.now").text).toBe(String(ms));
        t.dispose();
      }),
      { seed: SEED, numRuns: 50 },
    );
  });

  it("ctx.random is seeded: one seed gives one value, and the seed is what varies it", () => {
    const read = (seed: number): string => {
      const t = render(ClockView, { props: {}, ctx: simCtx(seed) });
      const v = t.find("rand").text;
      t.dispose();
      return v;
    };
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), (seed) => {
        expect(read(seed)).toBe(read(seed));
      }),
      { seed: SEED, numRuns: 50 },
    );
    expect(new Set([1, 2, 3, 4, 5].map(read)).size).toBeGreaterThan(1);
  });

  it("two runs with one seed produce equal state()", async () => {
    const run = async (seed: number, clicks: number) => {
      const t = render(CartView, { props: { compact: false }, state: [[cart, { items: [] }]], ctx: simCtx(seed) });
      for (let i = 0; i < clicks; i++) await t.fire("cart.add", { type: "click" });
      const st = JSON.stringify(t.state());
      t.dispose();
      return st;
    };
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 1000 }), fc.integer({ min: 0, max: 5 }), async (seed, clicks) => {
        expect(await run(seed, clicks)).toBe(await run(seed, clicks));
      }),
      { seed: SEED, numRuns: 30 },
    );
  });
});
