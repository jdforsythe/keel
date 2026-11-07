// Spec: std.timings, clause "Under a sim ctx, `time` around a `fn` that advances the clock by `d` records `lastMs` `d`.
// For generated duration lists of one name, `count`, `totalMs` and `maxMs` are the list's length, sum and maximum."
// Seed 1337
import { createCtx } from "@keel/ctx";
import { time, timingsOf } from "@keel/std-timings";
import fc from "fast-check";
import { expect, test } from "vitest";

const name = fc.stringMatching(/^[a-z]{3,8}\.[a-z]{3,8}$/);

test("Under a sim ctx, `time` around a `fn` that advances the clock by `d` records `lastMs` `d`", async () => {
  await fc.assert(
    fc.asyncProperty(name, fc.integer({ min: 0, max: 100_000 }), async (n, d) => {
      const ctx = createCtx({ mode: "sim" });
      await time(ctx, n, () => {
        ctx.clock.advance(d);
        return Promise.resolve(1);
      });
      expect(timingsOf(ctx)[n]?.lastMs).toBe(d);
    }),
    { seed: 1337, numRuns: 50 },
  );
});

test("For generated duration lists of one name, `count`, `totalMs` and `maxMs` are the list's length, sum and maximum", async () => {
  await fc.assert(
    fc.asyncProperty(
      name,
      fc.array(fc.integer({ min: 0, max: 10_000 }), { minLength: 1, maxLength: 12 }),
      async (n, ds) => {
        const ctx = createCtx({ mode: "sim" });
        for (const d of ds) {
          await time(ctx, n, () => {
            ctx.clock.advance(d);
            return Promise.resolve(null);
          });
        }
        const row = timingsOf(ctx)[n];
        expect(row?.count).toBe(ds.length);
        expect(row?.totalMs).toBe(ds.reduce((a, b) => a + b, 0));
        expect(row?.maxMs).toBe(Math.max(...ds));
        expect(row?.lastMs).toBe(ds[ds.length - 1]);
      },
    ),
    { seed: 1337, numRuns: 50 },
  );
});
