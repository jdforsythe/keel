// Spec: std.workflows, Conformance "Under sim, a started instance reaching a step state runs `run` once with `key` `<id>:<flow>:<entered>` and moves by its `done` event with the `ok` value."
// Seed: 1337.
// Assumption: as in fixtures.ts; the instance data and the instance row are read through `commitStores`.
import { ok } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { type Data, begin, boot, close, makeFlow, readRows, settle, sim, start } from "./fixtures.ts";

test.skip("Under sim, a started instance reaching a step state runs `run` once with `key` `<id>:<flow>:<entered>` and moves by its `done` event with the `ok` value.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 1, maxLength: 4 }), async (ns) => {
      const ctx = sim();
      const calls: { data: Data; key: string; signal: AbortSignal }[] = [];
      const f = makeFlow({
        run: async (data, _ctx, { signal, key }) => {
          calls.push({ data, key, signal });
          return ok({ freed: data.n });
        },
      });
      const app = await boot(ctx, f);
      const entered = new Map<string, number>();
      for (const n of ns) {
        const id = ctx.random.id("Flow");
        await start(ctx, f, id, { n, freed: 0, code: "" });
        entered.set(id, await begin(ctx, f, id));
      }
      await settle();
      const rows = await readRows(ctx, f);
      expect(calls).toHaveLength(ns.length);
      for (const [id, e] of entered) {
        const row = rows[id];
        const mine = calls.filter((c) => c.key.startsWith(`${id}:`));
        expect(mine).toHaveLength(1);
        expect(mine[0]?.key).toBe(`${id}:${f.id}:${e}`);
        expect(mine[0]?.signal).toBeInstanceOf(AbortSignal);
        expect(row?.state).toBe("purged");
        expect(row?.data.freed).toBe(mine[0]?.data.n);
        expect(row?.entered).toBe(e + 1);
      }
      await close(app);
    }),
    { seed: 1337, numRuns: 10 },
  );
});
