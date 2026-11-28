// Spec: k.store, clause "In that sequence, a store of id `y` in an isolated scope's registry is neither carried nor removed: after `storesLoaded()` `stores()` under that scope lists it, and a second store of id `y` in that registry still throws."
// "That sequence" is the takeover clause's: `storesReload()`, `storesFile('a.ts')`, a store of id `x` in the module registry, `storesLoaded()`, then `storesReload()`, `storesFile('a.ts')`, a store of id `x` taking it over.
// Here `y` is created in an isolated scope during the first load. Seed 1337 (fixtures `SEED`); each run uses ids of its own, file names drawn at random.
import { scope } from "@keel/reactive";
import { isolate, store, stores } from "@keel/store";
import { storesFile, storesLoaded, storesReload } from "@keel/store/internal";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { Cart, SEED } from "./fixtures";

const fileArb = fc.stringMatching(/^[a-z]{1,8}\.ts$/);
let n = 0;

function isolated(file: string, x: string, y: string): void {
  const iso = scope(() => {}, { detached: true });
  isolate(iso);
  storesReload();
  storesFile(file);
  const sx = scope(() => {}, { detached: true });
  sx.run(() => void store(Cart, { items: [] }, { id: x }));
  const held = iso.run(() => store(Cart, { items: [] }, { id: y }));
  storesLoaded();
  storesReload();
  storesFile(file);
  const sx2 = scope(() => {}, { detached: true });
  sx2.run(() => void store(Cart, { items: [] }, { id: x }));
  storesLoaded();
  expect(iso.run(() => stores().get(y))).toBe(held);
  const again = iso.run(() => scope(() => {}));
  expect(() => again.run(() => void store(Cart, { items: [] }, { id: y }))).toThrow();
  expect(iso.run(() => stores().get(y))).toBe(held);
  again.dispose();
  sx2.dispose();
  sx.dispose();
  iso.dispose();
}

describe("k.store Ids: isolated registries across a dev reload", () => {
  it("in that sequence, a store of id `y` in an isolated scope's registry is neither carried nor removed: after `storesLoaded()` `stores()` under that scope lists it, and a second store of id `y` in that registry still throws", () => {
    isolated("a.ts", "x", "y");
    fc.assert(
      fc.property(fileArb, (file) => {
        const k = String(n++);
        isolated(file, `is${k}.x`, `is${k}.y`);
      }),
      { seed: SEED, numRuns: 50 },
    );
  });
});
