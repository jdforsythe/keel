// @vitest-environment happy-dom
// Properties for simulate (k.sim): every SimRun parses and replays to the same trace. Seed: 1337.
import { type SimCtx, register } from "@keel/ctx";
import { s } from "@keel/schema";
import { SimRun, simulate } from "@keel/testing";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

// A trace of what one run saw: route calls with their clock time, each fetch's outcome and storage results.
async function trace(ctx: SimCtx, run: () => Promise<void>): Promise<unknown[]> {
  const out: unknown[] = [];
  ctx.net.route("https://sim.example.test/*", (req) => {
    out.push(["route", new URL(req.url).pathname, ctx.clock.now()]);
    return new Response("ok");
  });
  const done = Promise.all([
    ...[0, 1, 2, 3].map((i) =>
      ctx.net.fetch(new Request(`https://sim.example.test/${i}`)).then(
        (r) => r.status,
        () => "rejected",
      ),
    ),
    ctx.storage.set("k", "v").then(
      () => "set",
      () => "set failed",
    ),
  ]);
  await run();
  out.push(await done, ctx.clock.now(), ctx.random.float());
  return out;
}

describe("simulate", () => {
  it("property: every SimRun a scenario receives parses, round-trips through JSON and replays to the same trace", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 10_000 }), async (seed) => {
        const runs: { simRun: unknown; seen: unknown[] }[] = [];
        await simulate(
          async ({ ctx, seed: s, schedule, run }) => {
            runs.push({ simRun: { seed: s, schedule }, seen: await trace(ctx, run) });
          },
          { runs: 5, seed },
        );
        for (const { simRun, seen } of runs) {
          expect(SimRun.parse(JSON.parse(JSON.stringify(simRun))).ok).toBe(true);
          let again: unknown[] = [];
          await simulate(
            async ({ ctx, run }) => {
              again = await trace(ctx, run);
            },
            { replay: simRun },
          );
          expect(again).toEqual(seen);
        }
      }),
      { seed: 1337, numRuns: 20 },
    );
  });
});

describe("simulate plans", () => {
  it("plans are drawn in capability-name order, whatever the registration order, and a failure names them", async () => {
    register<object, number>("zz.sim.later", {
      real: () => ({}),
      shell: () => ({}),
      sim: () => ({}),
      plan: s.int({ min: 0, max: 3 }),
    });
    register<object, number>("zz.sim.early", {
      real: () => ({}),
      shell: () => ({}),
      sim: () => ({}),
      plan: s.int({ min: 0, max: 3 }),
    });
    const keys: string[][] = [];
    const e = await simulate(
      async ({ schedule }) => {
        keys.push(Object.keys(schedule.plans));
        throw new Error("planned failure");
      },
      { runs: 1, seed: 1337 },
    ).catch((x: unknown) => x);
    const ours = (k: readonly string[]) => k.filter((n) => n.startsWith("zz.sim."));
    for (const k of keys) expect(ours(k)).toEqual(["zz.sim.early", "zz.sim.later"]);
    expect(keys.every((k) => [...k].sort().join() === k.join())).toBe(true);
    expect(e instanceof Error ? e.message.split("\n")[0] : "").toContain("plans zz.sim.early, zz.sim.later");
  });
});
