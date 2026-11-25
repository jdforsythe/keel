// Spec: k.persist, clause "`commit` stores every `value` and resolves `true` when each `expect` matches; with one `expect` stale it stores nothing and resolves `false`; a write without `value` is checked and not stored."
// Seed: 1337.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCtx } from "@keel/ctx";
import type { Ctx } from "@keel/ctx";
import { fileStorage } from "@keel/ctx/node";
import fc from "fast-check";
import { afterAll, expect, it } from "vitest";

const SEED = 1337;
const dir = mkdtempSync(join(tmpdir(), "keel-storage-commit-"));
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

let n = 0;
const makers: ReadonlyArray<() => Ctx> = [
  () => createCtx({ mode: "sim", seed: SEED }),
  () => createCtx({ mode: "real", drivers: { storage: fileStorage(join(dir, `c${String(n++)}.json`)) } }),
];

const KEYS = ["a", "b", "c", "d", "e"] as const;
const valueArb = fc.string({ minLength: 1, maxLength: 4 });
const initialArb = fc.array(fc.option(valueArb, { nil: null }), { minLength: KEYS.length, maxLength: KEYS.length });

interface Plan {
  readonly key: string;
  readonly stale: boolean;
  readonly value: string | undefined;
}
const planArb: fc.Arbitrary<Plan[]> = fc
  .uniqueArray(fc.constantFrom(...KEYS), { minLength: 1, maxLength: KEYS.length })
  .chain((keys) =>
    fc.tuple(
      ...keys.map((key) =>
        fc.record({ key: fc.constant(key), stale: fc.boolean(), value: fc.option(valueArb, { nil: undefined }) }),
      ),
    ),
  );

async function seed(ctx: Ctx, initial: ReadonlyArray<string | null>): Promise<Map<string, string | null>> {
  const model = new Map<string, string | null>();
  for (const [i, k] of KEYS.entries()) {
    const v = initial[i] ?? null;
    model.set(k, v);
    if (v !== null) await ctx.storage.set(k, v);
  }
  return model;
}
const dump = (ctx: Ctx) => ctx.storage.read([...KEYS]);

it("`commit` stores every `value` and resolves `true` when each `expect` matches; with one `expect` stale it stores nothing and resolves `false`; a write without `value` is checked and not stored", async () => {
  // All expects match: every `value` is stored, a write without `value` leaves its key as it was.
  await fc.assert(
    fc.asyncProperty(initialArb, planArb, async (initial, plan) => {
      for (const make of makers) {
        const ctx = make();
        const model = await seed(ctx, initial);
        const writes = plan.map((p) => ({ key: p.key, expect: model.get(p.key) ?? null, value: p.value }));
        const ok = await ctx.storage.commit(
          writes.map((w) => (w.value === undefined ? { key: w.key, expect: w.expect } : w)),
        );
        expect(ok).toBe(true);
        for (const w of writes) if (w.value !== undefined) model.set(w.key, w.value);
        expect(await dump(ctx)).toEqual(KEYS.map((k) => model.get(k) ?? null));
      }
    }),
    { seed: SEED, numRuns: 50 },
  );

  // One expect stale: nothing is stored and it resolves false, whether the stale write has a value or is a condition only.
  await fc.assert(
    fc.asyncProperty(initialArb, planArb, fc.nat(), async (initial, plan, pick) => {
      const staleAt = pick % plan.length;
      for (const make of makers) {
        const ctx = make();
        const model = await seed(ctx, initial);
        const before = KEYS.map((k) => model.get(k) ?? null);
        const writes = plan.map((p, i) => {
          const current = model.get(p.key) ?? null;
          const expect = i === staleAt ? (current === null ? "stale" : `${current}!`) : current;
          return p.value === undefined ? { key: p.key, expect } : { key: p.key, expect, value: p.value };
        });
        expect(await ctx.storage.commit(writes)).toBe(false);
        expect(await dump(ctx)).toEqual(before);
      }
    }),
    { seed: SEED, numRuns: 50 },
  );

  // A write without `value` is a condition only: an absent key stays absent, and it still blocks the others when stale.
  for (const make of makers) {
    const ctx = make();
    expect(
      await ctx.storage.commit([
        { key: "gate", expect: null },
        { key: "x", expect: null, value: "1" },
      ]),
    ).toBe(true);
    expect(await ctx.storage.read(["gate", "x"])).toEqual([null, "1"]);
    expect(
      await ctx.storage.commit([
        { key: "gate", expect: "set" },
        { key: "y", expect: null, value: "2" },
      ]),
    ).toBe(false);
    expect(await ctx.storage.read(["gate", "y"])).toEqual([null, null]);
  }
});
