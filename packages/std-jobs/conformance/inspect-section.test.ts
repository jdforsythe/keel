// Spec: std.jobs, clause "The `jobs.queue` section holds counts and failures and no input value."
// Seed 1337
// Assumption: `createApp` needs no `routes` for a deployable whose module only has runners (`@keel/router` is not a dependency of this package).
// Assumption: the dev `/__keel/inspect` body has `sections['jobs.queue']` as `{ doc, value }` (std.timings pattern) and the value
// holds, per module, `{ pending, running, failed: { id, job, code, at }[] }`; the test locates the module entry by its `failed` array.
import { createCtx } from "@keel/ctx";
import { createApp, topology } from "@keel/server";
import { job, queue } from "@keel/std-jobs";
import { err, ok, s } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";

const settle = async () => {
  for (let i = 0; i < 200; i++) await Promise.resolve();
};
const word = fc.stringMatching(/^[a-z]{12,20}$/);

function find(v: unknown, depth = 0): Record<string, unknown> | undefined {
  if (depth > 6 || typeof v !== "object" || v === null) return undefined;
  if (Array.isArray(Reflect.get(v, "failed"))) return Object(v);
  for (const k of Object.keys(v)) {
    const hit = find(Reflect.get(v, k), depth + 1);
    if (hit) return hit;
  }
  return undefined;
}

test.skip("The `jobs.queue` section holds counts and failures and no input value.", async () => {
  await fc.assert(
    fc.asyncProperty(word, word, fc.integer({ min: 0, max: 3 }), async (failing, waiting, extra) => {
      const ctx = createCtx({ mode: "sim", seed: 1337 });
      const bad = job({ input: s.object({ note: s.string() }), attempts: 1 }, async () =>
        err({ code: "orders.rejected", message: "no", data: {} }),
      );
      const slow = job({ input: s.object({ note: s.string() }) }, async () => ok(null));
      const jobs = queue({ "orders.bad": bad, "orders.slow": slow });
      const app = await createApp({
        topology: topology({ web: { modules: ["orders"], adapter: "node" } }),
        ctx,
        mode: "dev",
        runners: { orders: [jobs] },
      });
      await jobs.enqueue(ctx, "orders.bad", { note: failing });
      for (let i = 0; i < 1 + extra; i++)
        await jobs.enqueue(ctx, "orders.slow", { note: waiting }, { delayMs: 60_000 });
      await settle();
      const res = await app.fetch(new Request("http://localhost/__keel/inspect"));
      const text = await res.text();
      expect(text).not.toContain(failing);
      expect(text).not.toContain(waiting);
      const body: unknown = JSON.parse(text);
      const sec = find(Reflect.get(Object(Reflect.get(Object(body), "sections")), "jobs.queue"));
      expect(sec?.pending).toBe(1 + extra);
      expect(sec?.running).toBe(0);
      const failed = Array.isArray(sec?.failed) ? sec.failed : [];
      expect(failed.length).toBe(1);
      expect(Object(failed[0]).code).toBe("orders.rejected");
      expect(Object(failed[0]).job).toBe("orders.bad");
      expect(Object.keys(Object(failed[0])).sort()).toEqual(["at", "code", "id", "job"]);
    }),
    { seed: 1337, numRuns: 10 },
  );
});
