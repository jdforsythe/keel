// Spec: std.workflows, clause "A `run` that returns `err` 3 times with `attempts: 3` leaves the instance after its `failed` event with that code; one that never settles ends there with `workflows.attempts`."
// Seed: 1337.
// Assumption: the clock is moved in 1,000 ms steps over 120 s, past every backoff and lease of the sim; the `failed` event of the step is `stuck`, whose payload `code` the chart keeps in `data.code`.
import { err, ok } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { begin, boot, close, makeFlow, pass, readRows, settle, sim, start } from "./fixtures.ts";

const fail = (code: string) => err({ code, message: "no", data: {} });

test("A `run` that returns `err` 3 times with `attempts: 3` leaves the instance after its `failed` event with that code.", async () => {
  const ctx = sim();
  let calls = 0;
  const f = makeFlow({
    attempts: 3,
    run: async () => {
      calls++;
      return fail("api.nope");
    },
  });
  const app = await boot(ctx, f);
  const id = ctx.random.id("Flow");
  await start(ctx, f, id, { n: 1, freed: 0, code: "" });
  const entered = await begin(ctx, f, id);
  await settle();
  await pass(ctx, 120_000);
  const row = (await readRows(ctx, f))[id];
  expect(calls).toBe(3);
  expect(row?.state).toBe("stuck");
  expect(row?.data.code).toBe("api.nope");
  expect(row?.entered).toBe(entered + 1);
  await close(app);
});

test("a `run` that returns `err` fewer than `attempts` times and then `ok` ends in `done`, with one run per attempt", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 0, max: 2 }), async (errs) => {
      const ctx = sim();
      const keys: string[] = [];
      const f = makeFlow({
        attempts: 3,
        run: async (_d, _c, { key }) => {
          keys.push(key);
          return keys.length <= errs ? fail("api.nope") : ok({ freed: 2 });
        },
      });
      const app = await boot(ctx, f);
      const id = ctx.random.id("Flow");
      await start(ctx, f, id, { n: 1, freed: 0, code: "" });
      await begin(ctx, f, id);
      await settle();
      await pass(ctx, 120_000);
      const row = (await readRows(ctx, f))[id];
      expect(keys).toHaveLength(errs + 1);
      expect(new Set(keys).size).toBe(1);
      expect(row?.state).toBe("purged");
      expect(row?.data.freed).toBe(2);
      await close(app);
    }),
    { seed: 1337, numRuns: 6 },
  );
});

test("A `run` that never settles ends in its `failed` event with `workflows.attempts`.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 3 }), async (attempts) => {
      const ctx = sim();
      let calls = 0;
      const f = makeFlow({
        attempts,
        timeoutMs: 1000,
        run: () => {
          calls++;
          return new Promise(() => undefined);
        },
      });
      const app = await boot(ctx, f);
      const id = ctx.random.id("Flow");
      await start(ctx, f, id, { n: 1, freed: 0, code: "" });
      await begin(ctx, f, id);
      await settle();
      await pass(ctx, 120_000);
      const row = (await readRows(ctx, f))[id];
      expect(row?.state).toBe("stuck");
      expect(row?.data.code).toBe("workflows.attempts");
      expect(calls).toBeGreaterThanOrEqual(1);
      expect(calls).toBeLessThanOrEqual(attempts);
      await close(app);
    }),
    { seed: 1337, numRuns: 6 },
  );
});
