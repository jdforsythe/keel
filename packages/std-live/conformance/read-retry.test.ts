// Spec: std.live, clause "A read returning `err` commits nothing, `status()` is `connecting`, and reads run again 1 s, then 2 s, then 4 s later on `ctx.clock` until one succeeds."
// Seed 1337
import { ok } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { type Read, boardArb, boom, createServer, mount, settle, simCtx, tick } from "./fixtures.ts";
import type { BoardValue } from "./fixtures.ts";

test("A read returning `err` commits nothing, `status()` is `connecting`, and reads run again 1 s, then 2 s, then 4 s later on `ctx.clock` until one succeeds.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 5 }), boardArb, async (failures, board) => {
      const ctx = simCtx();
      const server = createServer();
      server.attach(ctx);
      const at: number[] = [];
      const read: Read = async (c) => {
        at.push(c.clock.now());
        return at.length <= failures ? boom() : ok<BoardValue>(board);
      };
      const m = mount(ctx, read);
      await settle();
      expect(at).toEqual([0]);
      let gap = 1000;
      for (let k = 1; k <= failures; k++) {
        expect(m.view.log()).toHaveLength(0);
        expect(m.status()).toBe("connecting");
        await tick(ctx, gap - 1);
        expect(at).toHaveLength(k);
        await tick(ctx, 1);
        expect(at).toHaveLength(k + 1);
        expect((at[k] ?? 0) - (at[k - 1] ?? 0)).toBe(gap);
        gap *= 2;
      }
      expect(m.view.log()).toHaveLength(1);
      expect(m.status()).toBe("live");
      await tick(ctx, 200_000);
      expect(at).toHaveLength(failures + 1);
      m.dispose();
    }),
    { seed: 1337, numRuns: 12 },
  );
});
