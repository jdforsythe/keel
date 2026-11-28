// Spec: k.store, clause "With no `storesReload()` call, a duplicate live id in the module registry throws whatever `storesFile` (`@keel/store/internal`) was called with."
// Seed 1337 (fixtures `opts`). This file never calls `storesReload`; every store is in the module registry (a plain, non-isolated scope).
import { scope } from "@keel/reactive";
import { store, stores } from "@keel/store";
import { storesFile } from "@keel/store/internal";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { Cart, SEED } from "./fixtures";

const fileArb = fc.stringMatching(/^[a-z]{1,8}\.ts$/);
let n = 0;

describe("k.store Ids: no storesReload, no takeover", () => {
  it("with no `storesReload()` call, a duplicate live id in the module registry throws whatever `storesFile` (`@keel/store/internal`) was called with", () => {
    fc.assert(
      fc.property(fileArb, fc.array(fileArb, { minLength: 1, maxLength: 6 }), (first, later) => {
        const id = `nr${String(n++)}.x`;
        storesFile(first);
        const owner = scope(() => {}, { detached: true });
        const held = owner.run(() => store(Cart, { items: [] }, { id }));
        const tries = later.map(() => scope(() => {}, { detached: true }));
        later.forEach((file, i) => {
          storesFile(file);
          expect(() => tries[i]?.run(() => store(Cart, { items: [] }, { id }))).toThrow();
          expect(stores().get(id)).toBe(held);
        });
        for (const t of tries) t.dispose();
        owner.dispose();
        expect(stores().has(id)).toBe(false);
      }),
      { seed: SEED, numRuns: 50 },
    );
  });

  it("the same file twice, as a file evaluated again would mark it, still throws on the duplicate", () => {
    storesFile("a.ts");
    const owner = scope(() => {}, { detached: true });
    owner.run(() => void store(Cart, { items: [] }, { id: "nr.same" }));
    storesFile("a.ts");
    const again = scope(() => {}, { detached: true });
    expect(() => again.run(() => void store(Cart, { items: [] }, { id: "nr.same" }))).toThrow();
    again.dispose();
    owner.dispose();
  });
});
