// Seed 1337
import { createCtx } from "@keel/ctx";
import fc from "fast-check";
import { expect, test } from "vitest";
import { time } from "../src/time.ts";
import { timingsOf } from "../src/timingsOf.ts";

const SEED = 1337;

test("per name, totalMs >= maxMs >= lastMs >= 0 and count is the number of calls, over interleaved names", async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(fc.tuple(fc.constantFrom("a", "b"), fc.nat(500)), { maxLength: 20 }), async (calls) => {
      const ctx = createCtx({ mode: "sim", seed: SEED });
      for (const [name, d] of calls) await time(ctx, name, () => ctx.clock.advance(d));
      const t = timingsOf(ctx);
      for (const name of ["a", "b"]) {
        const n = calls.filter(([x]) => x === name).length;
        const st = t[name];
        if (n === 0) expect(st).toBeUndefined();
        else if (st === undefined) throw new Error(`no timings for ${name}`);
        else {
          expect(st.count).toBe(n);
          expect(st.totalMs >= st.maxMs && st.maxMs >= st.lastMs && st.lastMs >= 0).toBe(true);
        }
      }
    }),
    { seed: SEED, numRuns: 50 },
  );
});
