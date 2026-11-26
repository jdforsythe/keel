// Spec: k.sim (`run()` settles as the harness does: a request in flight is work to wait for, as a harness's page load
// is). A route that answers after real I/O, such as a server on another ctx, has answered once `run()` resolves. Seed: 1337.
import { readFile } from "node:fs/promises";
import type { SimCtx } from "@keel/ctx";
import { simulate } from "@keel/testing";
import { fixedTime } from "@keel/tooling/test-time";
import { describe, expect, it } from "vitest";

/** Fetch through a route that reads this file 20 times before it answers; the answer, once `run()` resolved. */
async function answered(ctx: SimCtx, run: () => Promise<void>): Promise<string[]> {
  const seen: string[] = [];
  ctx.net.route("https://app.test/*", async () => {
    for (let i = 0; i < 20; i++) await readFile(new URL(import.meta.url));
    return new Response("done");
  });
  void ctx.net.fetch(new Request("https://app.test/x")).then(
    async (r) => void seen.push(`${r.status}`),
    () => void seen.push("rejected"),
  );
  await run();
  return seen;
}

describe("simulate run()", () => {
  it("resolves after a route doing real I/O has answered", async () => {
    let seen: string[] = [];
    await simulate(
      async ({ ctx, run }) => {
        seen = await answered(ctx, run);
      },
      { replay: { seed: 1, schedule: { net: [], storage: [], offline: [], plans: {} } } },
    );
    expect(seen).toEqual(["200"]);
  });

  // Each run's route reads this file 20 times: about 50 ms a run here, so 1 s a run for the 20 runs.
  it(
    "property: under any schedule the request has an outcome once run() resolves",
    { timeout: fixedTime(20 * 1_000) },
    async () => {
      await simulate(
        async ({ ctx, run }) => {
          expect(await answered(ctx, run)).toHaveLength(1);
        },
        { runs: 20 },
      );
    },
  );
});
