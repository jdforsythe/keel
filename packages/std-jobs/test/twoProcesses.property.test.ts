// std.jobs Run: processes sharing one storage driver never lease one job twice. Two runners whose storage objects
// differ (as two processes' do) but reach one store, with reads delayed by a generated number of turns so their
// commits race, run each due job once. Seed 1337.
import { type Ctx, type KeyValueStorage, createCtx } from "@keel/ctx";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { job, queue } from "../src/index.ts";

const turns = async (n: number) => {
  for (let i = 0; i < n; i++) await Promise.resolve();
};
const settle = () => turns(300);

const process2 = (ctx: Ctx, delay: () => number): Ctx => {
  const shared = ctx.storage;
  const storage: KeyValueStorage = {
    get: (k) => shared.get(k),
    set: (k, v) => shared.set(k, v),
    read: async (keys) => {
      const got = await shared.read(keys);
      await turns(delay());
      return got;
    },
    commit: (writes) => shared.commit(writes),
  };
  return { clock: ctx.clock, random: ctx.random, net: ctx.net, storage };
};

test("Two processes over one storage run each of five due jobs once", async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(fc.integer({ min: 0, max: 6 }), { minLength: 1, maxLength: 20 }), async (delays) => {
      const ctx = createCtx({ mode: "sim", seed: 1337 });
      let i = 0;
      const delay = () => delays[i++ % delays.length] ?? 0;
      const ran: number[] = [];
      const jobs = queue({
        "orders.work": job({ input: s.object({ n: s.int() }) }, async ({ n }) => {
          ran.push(n);
          return ok(null);
        }),
      });
      for (const n of [1, 2, 3, 4, 5]) await jobs.enqueue(ctx, "orders.work", { n });
      const stop = new AbortController();
      const a = jobs.run(process2(ctx, delay), stop.signal);
      const b = jobs.run(process2(ctx, delay), stop.signal);
      for (let k = 0; k < 6; k++) {
        await settle();
        ctx.clock.advance(2000);
      }
      await settle();
      stop.abort();
      await Promise.all([a, b]);
      expect([...ran].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5]);
    }),
    { seed: 1337, numRuns: 30 },
  );
});
