// std.jobs Run: "at most `concurrency` at once (module `std` config `{ concurrency }`, 1 to 16, default 1)", through a
// `.keel/std.json` that `stdArtifact` builds (with its content hash) and `createApp({ std })` binds.
// Seed 1337
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stdArtifact } from "@keel/compiler";
import { createCtx } from "@keel/ctx";
import { ok, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { tempDir } from "@keel/tooling/test-tmp";
import fc from "fast-check";
import { expect, test } from "vitest";
import { job, queue } from "../src/index.ts";

const settle = async () => {
  for (let i = 0; i < 200; i++) await Promise.resolve();
};
const manifest = (std: string) =>
  `import { module } from "@keel/compiler"\nexport default module({ id: "orders", deps: ["@keel/std-jobs"], capabilities: ["clock", "random", "storage"]${std} })\n`;

async function drive(concurrency: number | undefined, count: number): Promise<{ max: number; done: number }> {
  const dir = tempDir("keel-jobs-");
  try {
    const std = concurrency === undefined ? "" : `, std: { "@keel/std-jobs": { concurrency: ${concurrency} } }`;
    const { data, hash } = stdArtifact([{ path: "modules/orders/module.ts", source: manifest(std) }]);
    const file = join(dir, "std.json");
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
    for (let n = 0; n < count; n++) void (await jobs.enqueue(ctx, "orders.work", { n }));
    await settle();
    for (let guard = 0; guard < count * 2 && done < count; guard++) {
      gates.shift()?.();
      await settle();
    }
    await app.close();
    return { max, done };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("With `concurrency: 2` and five due jobs, at most two `fn` calls are pending at any time.", async () => {
  expect(await drive(2, 5)).toEqual({ max: 2, done: 5 });
});

test("Without config a queue runs one job at a time.", async () => {
  expect(await drive(undefined, 4)).toEqual({ max: 1, done: 4 });
});

test("For generated `concurrency` from 1 to 16 and job counts, pending `fn` calls never exceed it and every job runs.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 16 }), fc.integer({ min: 1, max: 20 }), async (c, n) => {
      expect(await drive(c, n)).toEqual({ max: Math.min(c, n), done: n });
    }),
    { seed: 1337, numRuns: 10 },
  );
});
