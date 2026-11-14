// Spec: std.workflows, Conformance "A wait state moves by its event when the sim clock passes `ms`, not before; an undo sent first leaves the wake job doing nothing."
// Seed: 1337.
// Assumption: a wait lasts at least `ms` and at most `ms` plus the 60,000 ms poll of the runner (Run paragraph), so the move is looked for in that window.
import { ok } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { boot, close, hide, makeFlow, pass, readRows, settle, sim, start, undo } from "./fixtures.ts";

const idle = async () => ok({ freed: 0 });

test.skip("A wait state moves by its event when the sim clock passes `ms`, not before.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 6 }), async (secs) => {
      const ms = secs * 1000;
      const ctx = sim();
      const f = makeFlow({ run: idle, ms });
      const app = await boot(ctx, f);
      const id = ctx.random.id("Flow");
      await start(ctx, f, id, { n: 0, freed: 0, code: "" });
      const entered = await hide(ctx, f, id);
      await settle();
      const t0 = ctx.clock.now();
      let movedAt: number | undefined;
      for (let t = 0; t <= ms + 60_000 && movedAt === undefined; t += 1000) {
        const row = (await readRows(ctx, f))[id];
        if (row?.state === "gone") movedAt = ctx.clock.now() - t0;
        else expect(row?.state).toBe("hidden");
        if (movedAt === undefined) await pass(ctx, 1000);
      }
      expect(movedAt).toBeDefined();
      expect(movedAt ?? 0).toBeGreaterThanOrEqual(ms);
      expect((await readRows(ctx, f))[id]?.entered).toBe(entered + 1);
      await close(app);
    }),
    { seed: 1337, numRuns: 6 },
  );
});

test.skip("an undo sent first leaves the wake job doing nothing.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 6 }), fc.integer({ min: 0, max: 5 }), async (secs, before) => {
      const ms = secs * 1000;
      const ctx = sim();
      const f = makeFlow({ run: idle, ms });
      const app = await boot(ctx, f);
      const id = ctx.random.id("Flow");
      await start(ctx, f, id, { n: 0, freed: 0, code: "" });
      await hide(ctx, f, id);
      await settle();
      await pass(ctx, Math.min(before, secs - 1) * 1000);
      const back = await undo(ctx, f, id);
      await settle();
      await pass(ctx, ms + 120_000);
      const row = (await readRows(ctx, f))[id];
      expect(row?.state).toBe("queued");
      expect(row?.entered).toBe(back);
      await close(app);
    }),
    { seed: 1337, numRuns: 6 },
  );
});
