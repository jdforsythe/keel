// Spec: k.sim, clause "`clock.next()` is the earliest pending `after` deadline, and `null` once `advance` has passed every one or each waiter aborted."
// Seed: 1337.
import { createCtx } from "@keel/ctx";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const SEED = 1337;

const sim = () => createCtx({ mode: "sim", seed: SEED }).clock;

describe("k.sim: clock.next", () => {
  test("`clock.next()` is null with no waiter", () => {
    expect(sim().next()).toBeNull();
  });

  test("`clock.next()` is the earliest pending `after` deadline", () => {
    const c = sim();
    void c.after(80);
    void c.after(30);
    void c.after(50);
    expect(c.next()).toBe(30);
    c.advance(10);
    expect(c.next()).toBe(30);
  });

  test("`clock.next()` is null once `advance` has passed every deadline", () => {
    const c = sim();
    void c.after(30);
    void c.after(50);
    c.advance(30);
    expect(c.next()).toBe(50);
    c.advance(20);
    expect(c.next()).toBeNull();
  });

  test("`clock.next()` is null once each waiter aborted", async () => {
    const c = sim();
    const a = new AbortController();
    const b = new AbortController();
    const pa = c.after(30, a.signal);
    const pb = c.after(50, b.signal);
    a.abort();
    b.abort();
    await expect(pa).rejects.toBeDefined();
    await expect(pb).rejects.toBeDefined();
    expect(c.next()).toBeNull();
  });

  test("property: `clock.next()` is the minimum pending deadline, null when none is pending", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 1000 }), { maxLength: 10 }),
        fc.integer({ min: 0, max: 1200 }),
        (delays, adv) => {
          const c = sim();
          for (const d of delays) void c.after(d);
          c.advance(adv);
          const pending = delays.filter((d) => d > adv);
          expect(c.next()).toBe(pending.length === 0 ? null : Math.min(...pending));
        },
      ),
      { seed: SEED },
    );
  });
});
