// Spec: std.timings, clause "A kept name with `count` 2 or more stays kept, whatever names are called once, until 192 other names had a repeat call since its last call; `dropped` counts each evicted name."
// Seed 1337
// @vitest-environment happy-dom
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { createApp, topology } from "@keel/server";
import { time, timingsOf } from "@keel/std-timings";
import fc from "fast-check";
import { expect, test } from "vitest";

const appContract = contract("app", {
  "app.home": { path: "/" },
});

const routes = manifest(appContract, {
  "app.home": {
    component: () => {
      const e = document.createElement("main");
      e.append("home");
      return e;
    },
  },
});

async function droppedOf(ctx: ReturnType<typeof createCtx>): Promise<unknown> {
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx,
    mode: "dev",
  });
  const res = await app.fetch(new Request("http://localhost/__keel/inspect"));
  const body: unknown = await res.json();
  const sections = Reflect.get(Object(body), "sections");
  const section = Reflect.get(Object(sections), "timings.recent");
  const value = Reflect.get(Object(section), "value");
  return Reflect.get(Object(value), "dropped");
}

test("A kept name with count 2 or more stays kept whatever names are called once; dropped counts each evicted name (backlog repro)", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  for (let i = 0; i < 1000; i++) await time(ctx, "db", () => Promise.resolve(0));
  for (let i = 0; i < 256; i++) await time(ctx, `GET /u/${i}`, () => Promise.resolve(0));
  expect(timingsOf(ctx).db?.count).toBe(1000);
  expect(await droppedOf(ctx)).toBe(1);
});

const scenario = fc
  .tuple(
    fc.integer({ min: 2, max: 10 }),
    fc.integer({ min: 0, max: 400 }),
    fc.uniqueArray(fc.nat({ max: 600 }), { maxLength: 400 }),
  )
  .chain(([k, m, singles]) => {
    const items: string[] = singles.map((v) => `s${v}`);
    for (let j = 0; j < m; j++) items.push(`r${j}`, `r${j}`);
    return fc
      .shuffledSubarray(items, { minLength: items.length, maxLength: items.length })
      .map((order) => ({ k, order }));
  });

test("A kept name with count 2 or more stays kept until 192 other names had a repeat call since its last call; dropped counts each evicted name", async () => {
  await fc.assert(
    fc.asyncProperty(scenario, async ({ k, order }) => {
      const ctx = createCtx({ mode: "sim", seed: 1337 });
      for (let i = 0; i < k; i++) await time(ctx, "db", () => Promise.resolve(0));
      const repeaters = new Set<string>();
      let vanished = 0;
      for (const name of order) {
        const before = new Set(Object.keys(timingsOf(ctx)));
        const wasKept = before.has(name);
        await time(ctx, name, () => Promise.resolve(0));
        const after = new Set(Object.keys(timingsOf(ctx)));
        const gone = [...before].filter((n) => !after.has(n));
        if (wasKept || before.size < 256) expect(gone).toEqual([]);
        else expect(gone).toHaveLength(1);
        expect(after.has(name)).toBe(true);
        vanished += gone.length;
        if (wasKept) repeaters.add(name);
        if (repeaters.size < 192) expect(timingsOf(ctx).db?.count).toBe(k);
      }
      expect(await droppedOf(ctx)).toBe(vanished);
    }),
    { seed: 1337, numRuns: 8 },
  );
});
