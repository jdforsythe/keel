// std.workflows Crashes and replay: for generated crash points (a `close()` after a generated number of turns, then a
// new `createApp` on the same ctx), across every boundary of a step (before `attempt`, during `run`, before and after
// `done`), the step's effect is recorded once: the store's log holds one `done` entry for the instance, every run used
// one `key`, and the instance ends in the `done` state with that run's value. Seed 1337.
import { ok } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { begin, boot, close, makeFlow, mutate, pass, settle, sim, start } from "../conformance/fixtures.ts";

const turns = async (n: number) => {
  for (let i = 0; i < n; i++) await Promise.resolve();
};

test("Crashes at generated points of a step record its effect once", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(fc.integer({ min: 0, max: 60 }), { minLength: 1, maxLength: 6 }),
      fc.integer({ min: 0, max: 8 }),
      async (crashes, slow) => {
        const ctx = sim();
        const keys: string[] = [];
        const effects = new Set<string>();
        const f = makeFlow({
          timeoutMs: 5000,
          attempts: 10,
          run: async (data, _ctx, { key }) => {
            keys.push(key);
            await turns(slow);
            effects.add(key);
            return ok({ freed: data.n });
          },
        });
        const id = ctx.random.id("Flow");
        let app = await boot(ctx, f);
        await start(ctx, f, id, { n: 2, freed: 0, code: "" });
        await begin(ctx, f, id);
        for (const at of crashes) {
          await turns(at);
          await close(app);
          app = await boot(ctx, f);
        }
        await settle();
        await pass(ctx, 130_000);
        const { row, done } = await mutate(ctx, f, (S) => ({
          row: S.store.get("instances")[id],
          done: S.store.log().filter((e) => e.name === `${f.id}.purged`).length,
        }));
        expect(row?.state).toBe("purged");
        expect(row?.data.freed).toBe(2);
        expect(done).toBe(1);
        expect(new Set(keys).size).toBe(1);
        expect(effects.size).toBe(1);
        await close(app);
      },
    ),
    { seed: 1337, numRuns: 40 },
  );
});
