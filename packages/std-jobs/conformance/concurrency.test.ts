// Spec: std.jobs, clause "With `concurrency: 2` and five due jobs, at most two `fn` calls are pending at any time."
// Seed 1337
// Assumption: `createApp` needs no `routes` for a deployable whose module only has runners (`@keel/router` is not a dependency of this package).
// Assumption: module `std` config reaches the runner through `createApp({ std })` (k.module Std config): a file `{ data, hash }`
// with `data` as `{ [pkg]: { [moduleId]: config } }` and `hash` as `stdArtifact` computes it from the module manifest.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stdArtifact } from "@keel/compiler";
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

async function drive(concurrency: number, count: number): Promise<{ max: number; done: number }> {
  const dir = mkdtempSync(join(tmpdir(), "keel-jobs-"));
  try {
    const file = join(dir, "std.json");
    const { data, hash } = stdArtifact([
      {
        path: "modules/orders/module.ts",
        source: `import { module } from "@keel/compiler"\nexport default module({ id: "orders", deps: ["@keel/std-jobs"], capabilities: ["clock", "random", "storage"], std: { "@keel/std-jobs": { concurrency: ${concurrency} } } })\n`,
      },
    ]);
    writeFileSync(file, JSON.stringify({ data, hash }));
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    const gates: (() => void)[] = [];
    let pending = 0;
    let max = 0;
    let done = 0;
    const work = job({ input: s.object({ n: s.number() }) }, () => {
      pending++;
      max = Math.max(max, pending);
      return new Promise((resolve) => {
        gates.push(() => {
          pending--;
          done++;
          resolve(ok(null));
        });
      });
    });
    const jobs = queue({ "orders.work": work });
    const app = await createApp({
      topology: topology({ web: { modules: ["orders"], adapter: "node" } }),
      ctx,
      mode: "dev",
      std: file,
      runners: { orders: [jobs] },
    });
    for (let n = 0; n < count; n++) await jobs.enqueue(ctx, "orders.work", { n });
    await settle();
    for (let guard = 0; guard < count * 2 && done < count; guard++) {
      const g = gates.shift();
      if (g) g();
      await settle();
    }
    await close(app);
    return { max, done };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("With `concurrency: 2` and five due jobs, at most two `fn` calls are pending at any time.", async () => {
  expect(await drive(2, 5)).toEqual({ max: 2, done: 5 });
});

test("For generated `concurrency` from 1 to 16 and generated job counts, the pending `fn` calls never exceed `concurrency` and every job runs.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 16 }), fc.integer({ min: 1, max: 20 }), async (c, n) => {
      expect(await drive(c, n)).toEqual({ max: Math.min(c, n), done: n });
    }),
    { seed: 1337, numRuns: 10 },
  );
});
