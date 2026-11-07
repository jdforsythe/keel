// Spec: std.timings, clause "Two ctxs keep separate timings; a fresh ctx gives `{}`."
// Seed 1337
import { createCtx } from "@keel/ctx";
import { time, timingsOf } from "@keel/std-timings";
import fc from "fast-check";
import { expect, test } from "vitest";

test("Two ctxs keep separate timings; a fresh ctx gives `{}`", async () => {
  expect(timingsOf(createCtx({ mode: "sim" }))).toEqual({});
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 0, max: 5000 }), fc.integer({ min: 1, max: 5 }), async (d, k) => {
      const a = createCtx({ mode: "sim" });
      const b = createCtx({ mode: "sim" });
      for (let i = 0; i < k; i++) {
        await time(a, "orders.load", () => {
          a.clock.advance(d);
          return Promise.resolve(0);
        });
      }
      expect(timingsOf(a)["orders.load"]?.count).toBe(k);
      expect(timingsOf(b)).toEqual({});
      await time(b, "other", () => Promise.resolve(0));
      expect(Object.keys(timingsOf(a))).toEqual(["orders.load"]);
      expect(Object.keys(timingsOf(b))).toEqual(["other"]);
    }),
    { seed: 1337, numRuns: 30 },
  );
});
