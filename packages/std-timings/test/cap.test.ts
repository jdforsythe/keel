// Seed 1337
import { inspector } from "@keel/compiler/inspect/inspector";
import { inspectors } from "@keel/compiler/inspect/inspectors";
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { MAX_NAMES } from "../src/internal/MAX_NAMES.ts";
import { readRecent as recentOf } from "../src/internal/readRecent.ts";
import { registerSection } from "../src/internal/registerSection.ts";
import { time } from "../src/time.ts";
import { timingsOf } from "../src/timingsOf.ts";

const SEED = 1337;

test("backlog 0162: after 256 request-derived names, db is kept and the oldest name is evicted", async () => {
  const ctx = createCtx({ mode: "sim", seed: SEED });
  for (let i = 0; i < 256; i++) await time(ctx, `GET /u/${i}`, () => 1);
  await time(ctx, "db", () => 1);
  expect(timingsOf(ctx).db?.count).toBe(1);
  expect(timingsOf(ctx)["GET /u/0"]).toBeUndefined();
  expect(Object.keys(timingsOf(ctx)).length).toBe(MAX_NAMES);
  expect(recentOf(ctx).dropped).toBe(1);
});

test("an updated name moves to the recent end: the next new name evicts the next oldest", async () => {
  const ctx = createCtx({ mode: "sim", seed: SEED });
  for (let i = 0; i < MAX_NAMES; i++) await time(ctx, `n${i}`, () => 1);
  await time(ctx, "n0", () => 1);
  await time(ctx, "fresh", () => 1);
  expect(timingsOf(ctx).n0?.count).toBe(2);
  expect(timingsOf(ctx).n1).toBeUndefined();
  expect(recentOf(ctx).dropped).toBe(1);
  expect(recentOf(createCtx({ mode: "sim", seed: SEED }))).toEqual({ timings: {}, dropped: 0 });
});

test("property: the retained names are always the most recently updated <= 256, and dropped counts evictions", async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(fc.nat({ max: 299 }), { maxLength: 700 }), async (ids) => {
      const ctx = createCtx({ mode: "sim", seed: SEED });
      const lastUse = new Map<string, number>();
      let seen = new Set<string>();
      let dropped = 0;
      for (const [at, id] of ids.entries()) {
        const name = `n${id}`;
        if (!seen.has(name) && seen.size >= MAX_NAMES) {
          const oldest = [...seen].sort((a, b) => (lastUse.get(a) ?? 0) - (lastUse.get(b) ?? 0))[0];
          seen = new Set([...seen].filter((n) => n !== oldest));
          dropped += 1;
        }
        seen.add(name);
        lastUse.set(name, at);
        await time(ctx, name, () => 1);
      }
      const recent = [...lastUse.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_NAMES)
        .map(([n]) => n)
        .sort();
      expect(Object.keys(timingsOf(ctx))).toEqual(recent);
      expect(recentOf(ctx).dropped).toBe(dropped);
    }),
    { seed: SEED, numRuns: 30 },
  );
});

test("registering the same reader again from the same module instance is a no-op", () => {
  expect(() => registerSection(recentOf)).not.toThrow();
  expect(inspectors.get("timings.recent")?.read).toBe(recentOf);
});

test("a second module instance with the same section id throws E1057", () => {
  expect(() => registerSection((ctx) => ({ timings: timingsOf(ctx), dropped: 0 }))).toThrow(/^E1057/);
});

test("a different definition under timings.recent still throws E1057", () => {
  expect(() => inspector({ id: "timings.recent", schema: s.int(), read: () => 1 })).toThrow(/^E1057/);
});
