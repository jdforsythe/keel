// Spec: k.store, clause "After `storesReload()`, `storesFile('a.ts')`, a store of id `x` created in the module registry, `storesLoaded()`, then `storesReload()` and `storesFile('a.ts')`: a store created with id `x` takes it over, `stores()` lists the new store, and a second store of id `x` created before `storesLoaded()` throws `id already in use`; with `storesFile('b.ts')` in the second load instead, the first creation throws."
// Seed 1337 (fixtures `SEED`). Functions from `@keel/store/internal`, the entry the spec names. Module state lasts across runs, so each run uses an id of its own (`x` stands for it) and file names drawn at random (`a.ts`, `b.ts` stand for a file and a different one); the literal case runs first.
import { scope } from "@keel/reactive";
import { store, stores } from "@keel/store";
import { storesFile, storesLoaded, storesReload } from "@keel/store/internal";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { Cart, SEED } from "./fixtures";

const fileArb = fc.stringMatching(/^[a-z]{1,8}\.ts$/);
let n = 0;

/** The first load: `storesReload()`, `storesFile(file)`, a store of `id` in the module registry, `storesLoaded()`. */
function firstLoad(file: string, id: string) {
  storesReload();
  storesFile(file);
  const sc = scope(() => {});
  const held = sc.run(() => store(Cart, { items: [] }, { id }));
  storesLoaded();
  return { sc, held };
}

/** Same file in the second load: the creation takes the id over, a second one throws `id already in use`. */
function sameFile(file: string, id: string): void {
  const first = firstLoad(file, id);
  storesReload();
  storesFile(file);
  const sc2 = scope(() => {});
  const taker = sc2.run(() => store(Cart, { items: [] }, { id }));
  expect(taker).not.toBe(first.held);
  expect(stores().get(id)).toBe(taker);
  const sc3 = scope(() => {});
  expect(() => sc3.run(() => void store(Cart, { items: [] }, { id }))).toThrow("id already in use");
  expect(stores().get(id)).toBe(taker);
  storesLoaded();
  sc3.dispose();
  sc2.dispose();
  first.sc.dispose();
}

/** Another file in the second load: the first creation throws. */
function otherFile(file: string, other: string, id: string): void {
  const first = firstLoad(file, id);
  storesReload();
  storesFile(other);
  const sc2 = scope(() => {});
  expect(() => sc2.run(() => void store(Cart, { items: [] }, { id }))).toThrow();
  storesLoaded();
  sc2.dispose();
  first.sc.dispose();
}

describe("k.store Ids: takeover across a dev reload", () => {
  it("after `storesReload()`, `storesFile('a.ts')`, a store of id `x` created in the module registry, `storesLoaded()`, then `storesReload()` and `storesFile('a.ts')`: a store created with id `x` takes it over, `stores()` lists the new store, and a second store of id `x` created before `storesLoaded()` throws `id already in use`", () => {
    sameFile("a.ts", "x");
    fc.assert(
      fc.property(fileArb, (file) => sameFile(file, `tk${String(n++)}.x`)),
      { seed: SEED, numRuns: 50 },
    );
  });

  it("with `storesFile('b.ts')` in the second load instead, the first creation throws", () => {
    otherFile("a.ts", "b.ts", `tk${String(n++)}.x`);
    fc.assert(
      fc.property(fileArb, fileArb, (file, other) => {
        fc.pre(file !== other);
        otherFile(file, other, `tk${String(n++)}.x`);
      }),
      { seed: SEED, numRuns: 50 },
    );
  });
});
