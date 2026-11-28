// Seed 1337
import { createCtx } from "@keel/ctx";
import fc from "fast-check";
import { expect, test } from "vitest";
import { Health } from "../src/Health.schema.ts";
import { loadHealth } from "../src/loadHealth.server.ts";

const SEED = 1337;

test("loadHealth reports ok at the ctx clock's now, and the value parses with Health", async () => {
  await fc.assert(
    fc.asyncProperty(fc.nat(1_000_000), async (ms) => {
      const ctx = createCtx({ mode: "sim", seed: SEED });
      await ctx.clock.advance(ms);
      const r = await loadHealth.run(
        { params: undefined, search: undefined, url: "http://x/health", caller: "", stores: undefined },
        ctx,
      );
      expect(r).toEqual({ ok: true, value: { status: "ok", at: ms } });
      expect(r.ok && Health.parse(r.value).ok).toBe(true);
    }),
    { seed: SEED, numRuns: 30 },
  );
});
