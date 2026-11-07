// Seed 1337
import { inspector } from "@keel/compiler/inspect/inspector";
import { inspectors } from "@keel/compiler/inspect/inspectors";
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { MAX_NAMES } from "../src/internal/MAX_NAMES.ts";
import { MAX_PROTECTED } from "../src/internal/MAX_PROTECTED.ts";
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

test("an updated name is protected: the next new name evicts the oldest unprotected one", async () => {
  const ctx = createCtx({ mode: "sim", seed: SEED });
  for (let i = 0; i < MAX_NAMES; i++) await time(ctx, `n${i}`, () => 1);
  await time(ctx, "n0", () => 1);
  await time(ctx, "fresh", () => 1);
  expect(timingsOf(ctx).n0?.count).toBe(2);
  expect(timingsOf(ctx).n1).toBeUndefined();
  expect(recentOf(ctx).dropped).toBe(1);
  expect(recentOf(createCtx({ mode: "sim", seed: SEED }))).toEqual({ timings: {}, dropped: 0 });
});

test("backlog 0172 repro: db x1000, then 256 request-derived names: db keeps its count", async () => {
  const ctx = createCtx({ mode: "sim", seed: SEED });
  for (let i = 0; i < 1000; i++) await time(ctx, "db", () => 1);
  for (let i = 0; i < 256; i++) await time(ctx, `GET /u/${i}`, () => 1);
  expect(timingsOf(ctx).db?.count).toBe(1000);
  expect(timingsOf(ctx)["GET /u/0"]).toBeUndefined();
  expect(Object.keys(timingsOf(ctx)).length).toBe(MAX_NAMES);
  expect(recentOf(ctx).dropped).toBe(1);
});

test("past 192 protected names the least recent moves back unprotected, uncounted, and is evicted first", async () => {
  const ctx = createCtx({ mode: "sim", seed: SEED });
  for (let i = 0; i <= MAX_PROTECTED; i++) {
    await time(ctx, `p${i}`, () => 1);
    await time(ctx, `p${i}`, () => 1);
  }
  expect(recentOf(ctx).dropped).toBe(0);
  for (let i = 0; i < MAX_NAMES - MAX_PROTECTED - 1; i++) await time(ctx, `f${i}`, () => 1);
  expect(Object.keys(timingsOf(ctx)).length).toBe(MAX_NAMES);
  // p0 moved back when p192 was protected, before any f name joined: it is the least recent unprotected name.
  expect(timingsOf(ctx).p0?.count).toBe(2);
  await time(ctx, "next", () => 1);
  expect(timingsOf(ctx).p0).toBeUndefined();
  expect(timingsOf(ctx).f0?.count).toBe(1);
  expect(timingsOf(ctx).p1?.count).toBe(2);
  expect(recentOf(ctx).dropped).toBe(1);
});

test("property: a name with >= 2 samples survives any sequence of single-sample names (seed 1337)", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 2, max: 12 }),
      fc.array(fc.nat({ max: 5 }), { maxLength: 150 }),
      fc.integer({ min: 0, max: 1200 }),
      async (k, kept, singles) => {
        const ctx = createCtx({ mode: "sim", seed: SEED });
        for (let i = 0; i < k; i++) await time(ctx, "db", () => 1);
        // Other names with history, fewer than MAX_PROTECTED in all.
        for (const [i, n] of kept.entries()) for (let j = 0; j <= n; j++) await time(ctx, `k${i}`, () => 1);
        for (let i = 0; i < singles; i++) await time(ctx, `GET /u/${i}`, () => 1);
        const t = timingsOf(ctx);
        expect(t.db?.count).toBe(k);
        for (const [i, n] of kept.entries()) if (n > 0) expect(t[`k${i}`]?.count).toBe(n + 1);
        expect(Object.keys(t).length).toBe(Math.min(MAX_NAMES, 1 + kept.length + singles));
        expect(recentOf(ctx).dropped).toBe(Math.max(0, 1 + kept.length + singles - MAX_NAMES));
      },
    ),
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
