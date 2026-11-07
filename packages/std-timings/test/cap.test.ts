// Seed 1337
import { inspector } from "@keel/compiler/inspect/inspector";
import { inspectors } from "@keel/compiler/inspect/inspectors";
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { MAX_NAMES } from "../src/internal/MAX_NAMES.ts";
import { registerSection } from "../src/internal/registerSection.ts";
import { time } from "../src/time.ts";
import { timingsOf } from "../src/timingsOf.ts";

const SEED = 1337;

test("names beyond the cap are not retained; retained names keep updating", async () => {
  const ctx = createCtx({ mode: "sim", seed: SEED });
  for (let i = 0; i < MAX_NAMES + 50; i++) await time(ctx, `n${i}`, () => 1);
  expect(Object.keys(timingsOf(ctx)).length).toBe(MAX_NAMES);
  expect(timingsOf(ctx)[`n${MAX_NAMES}`]).toBeUndefined();
  await time(ctx, "n0", () => 1);
  expect(timingsOf(ctx).n0?.count).toBe(2);
});

test("retained name count never exceeds the cap for arbitrary name sequences", async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(fc.string({ maxLength: 4 }), { maxLength: 600 }), async (names) => {
      const ctx = createCtx({ mode: "sim", seed: SEED });
      for (const n of names) await time(ctx, n, () => 1);
      expect(Object.keys(timingsOf(ctx)).length).toBeLessThanOrEqual(MAX_NAMES);
    }),
    { seed: SEED, numRuns: 30 },
  );
});

test("registering the same reader again from the same module instance is a no-op", () => {
  expect(() => registerSection(timingsOf)).not.toThrow();
  expect(inspectors.get("timings.recent")?.read).toBe(timingsOf);
});

test("a second module instance with the same section id throws E1057", () => {
  expect(() => registerSection((ctx) => timingsOf(ctx))).toThrow(/^E1057/);
});

test("a different definition under timings.recent still throws E1057", () => {
  expect(() => inspector({ id: "timings.recent", schema: s.int(), read: () => 1 })).toThrow(/^E1057/);
});
