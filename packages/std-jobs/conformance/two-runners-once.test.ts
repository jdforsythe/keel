// Spec: std.jobs, Conformance "Two `createApp`s on one sim ctx, each running the queue with five due jobs: each job's `fn` runs once."
// Seed: 1337.
// Assumption: `createApp` needs no `routes` for a deployable whose module only has runners (`@keel/router` is not a dependency of this package).
// Assumption: two `createApp`s on one sim ctx share its storage as two processes do (k.persist), so the second sees the first's leases.
import { createCtx } from "@keel/ctx";
import { ok, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { job, queue } from "@keel/std-jobs";
import fc from "fast-check";
import { expect, test } from "vitest";

const settle = async () => {
  for (let i = 0; i < 200; i++) await Promise.resolve();
};
const close = async (app: unknown): Promise<void> => {
  const f: unknown = Reflect.get(Object(app), "close");
  if (typeof f !== "function") throw new Error("ServerApp.close is missing");
  await Reflect.apply(f, app, []);
};

test("Two `createApp`s on one sim ctx, each running the queue with five due jobs: each job's `fn` runs once.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.uniqueArray(fc.integer({ min: 0, max: 1000 }), { minLength: 5, maxLength: 5 }), async (ns) => {
      const ctx = createCtx({ mode: "sim", seed: 1337 });
      const ran: number[] = [];
      const work = job({ input: s.object({ n: s.number() }) }, async (input) => {
        ran.push(input.n);
        return ok(null);
      });
      const jobs = queue({ "orders.work": work });
      for (const n of ns) await jobs.enqueue(ctx, "orders.work", { n });
      const boot = () =>
        createApp({
          topology: topology({ web: { modules: ["orders"], adapter: "node" } }),
          ctx,
          mode: "dev",
          runners: { orders: [jobs] },
        });
      const a = await boot();
      const b = await boot();
      await settle();
      for (let i = 0; i < 5; i++) {
        ctx.clock.advance(2000);
        await settle();
      }
      expect([...ran].sort((x, y) => x - y)).toEqual([...ns].sort((x, y) => x - y));
      await close(a);
      await close(b);
    }),
    { seed: 1337, numRuns: 10 },
  );
});
