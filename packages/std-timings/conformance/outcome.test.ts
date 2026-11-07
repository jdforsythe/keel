// Spec: std.timings, clauses "`time` returns `fn`'s value." and
// "When `fn` rejects, `time` rejects with the same reason, and the call is still counted."
// Seed 1337
import { createCtx } from "@keel/ctx";
import { time, timingsOf } from "@keel/std-timings";
import fc from "fast-check";
import { expect, test } from "vitest";

test("`time` returns `fn`'s value", async () => {
  await fc.assert(
    fc.asyncProperty(fc.jsonValue(), async (v) => {
      const ctx = createCtx({ mode: "sim" });
      const out = await time(ctx, "orders.load", () => Promise.resolve(v));
      expect(out).toEqual(v);
      expect(timingsOf(ctx)["orders.load"]?.count).toBe(1);
    }),
    { seed: 1337, numRuns: 50 },
  );
});

test("When `fn` rejects, `time` rejects with the same reason, and the call is still counted", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 0, max: 5000 }), async (d) => {
      const ctx = createCtx({ mode: "sim" });
      const reason = new Error("boom");
      let caught: unknown;
      try {
        await time(ctx, "orders.load", () => {
          ctx.clock.advance(d);
          return Promise.reject(reason);
        });
      } catch (e) {
        caught = e;
      }
      expect(caught).toBe(reason);
      const row = timingsOf(ctx)["orders.load"];
      expect(row?.count).toBe(1);
      expect(row?.lastMs).toBe(d);
    }),
    { seed: 1337, numRuns: 30 },
  );
});
