// Spec: k.store, clause "With no `storesReload()` call, a duplicate live id in the module registry throws whatever `storesFile` (`@keel/store/internal`) was called with."
// k.store, Ids and invariants "Outside k.data Dev the module registry never hands a live id to a second store."
// Seed 1337 (fixtures `opts`). Outside k.data Dev no `@keel/store/internal` function is called (only the dev server module calls them), so this file calls none.
// Model: a random sequence of creates and disposals over a small id pool in the module registry; a creation succeeds iff its id is not live, and `stores()` gives each live id its first holder.
import { type Scope, scope } from "@keel/reactive";
import { store, stores } from "@keel/store";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { Cart, SEED } from "./fixtures";

type Op = { kind: "create"; id: number } | { kind: "dispose"; id: number };
const opArb: fc.Arbitrary<Op> = fc.oneof(
  fc.integer({ min: 0, max: 3 }).map((id): Op => ({ kind: "create", id })),
  fc.integer({ min: 0, max: 3 }).map((id): Op => ({ kind: "dispose", id })),
);
let run = 0;

describe("k.store Ids: the module registry outside Dev", () => {
  it("outside k.data Dev the module registry never hands a live id to a second store", () => {
    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 30 }), (ops) => {
        const prefix = `mr${String(run++)}`;
        const live = new Map<string, { sc: Scope; held: unknown }>();
        const spare: Scope[] = [];
        for (const op of ops) {
          const id = `${prefix}.s${String(op.id)}`;
          const holder = live.get(id);
          if (op.kind === "create") {
            const sc = scope(() => {}, { detached: true });
            if (holder === undefined) {
              live.set(id, { sc, held: sc.run(() => store(Cart, { items: [] }, { id })) });
            } else {
              expect(() => sc.run(() => void store(Cart, { items: [] }, { id }))).toThrow();
              spare.push(sc);
            }
          } else if (holder !== undefined) {
            holder.sc.dispose();
            live.delete(id);
          }
          for (const [k, v] of live) expect(stores().get(k)).toBe(v.held);
          for (let i = 0; i < 4; i += 1) {
            const k = `${prefix}.s${String(i)}`;
            if (!live.has(k)) expect(stores().has(k)).toBe(false);
          }
        }
        for (const v of live.values()) v.sc.dispose();
        for (const sc of spare) sc.dispose();
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
});
