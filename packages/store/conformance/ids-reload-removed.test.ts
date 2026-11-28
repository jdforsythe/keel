// Spec: k.store, clause "In that sequence, if the second load creates no store of id `x`, after `storesLoaded()` `stores()` lists no `x`, and an `effect` made in the scope that owned the first `x` does not run again when a signal it read is set."
// "That sequence" is the previous clause's: `storesReload()`, `storesFile('a.ts')`, a store of id `x` in the module registry, `storesLoaded()`, then `storesReload()` and `storesFile('a.ts')`.
// Seed 1337 (fixtures `SEED`). Module state lasts across runs, so each run uses an id of its own; file names drawn at random. The signal is made in a scope of its own, outside the owner, so the test can set it.
import { effect, scope, signal } from "@keel/reactive";
import { store, stores } from "@keel/store";
import { storesFile, storesLoaded, storesReload } from "@keel/store/internal";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { Cart, SEED } from "./fixtures";

const fileArb = fc.stringMatching(/^[a-z]{1,8}\.ts$/);
let n = 0;

function removed(file: string, id: string): void {
  const holder = scope(() => {});
  const sig = holder.run(() => signal(0));
  let runs = 0;
  storesReload();
  storesFile(file);
  const owner = scope(() => {
    effect(() => {
      sig.get();
      runs += 1;
    });
  });
  owner.run(() => void store(Cart, { items: [] }, { id }));
  storesLoaded();
  // the effect is live before the second load
  const before = runs;
  sig.set(1);
  expect(runs).toBeGreaterThan(before);
  storesReload();
  storesFile(file);
  storesLoaded();
  expect(stores().has(id)).toBe(false);
  const after = runs;
  sig.set(2);
  expect(runs).toBe(after);
  owner.dispose();
  holder.dispose();
}

describe("k.store Ids: an id no store took leaves at the load's end", () => {
  it("in that sequence, if the second load creates no store of id `x`, after `storesLoaded()` `stores()` lists no `x`, and an `effect` made in the scope that owned the first `x` does not run again when a signal it read is set", () => {
    removed("a.ts", "x");
    fc.assert(
      fc.property(fileArb, (file) => removed(file, `rm${String(n++)}.x`)),
      { seed: SEED, numRuns: 50 },
    );
  });
});
