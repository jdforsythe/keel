// Spec: k.sync Conformance, "`head()` is 0 for a new store and rises by exactly one per commit and per undo that undoes; a refused `tx` leaves it unchanged; each entry's `id` is the head after its commit."
// Seed 1337 (fast-check `seed: 1337`).
import { s } from "@keel/schema";
import { invariant, store, transaction, tx } from "@keel/store";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { inScope } from "./fixtures";

const Bag = s.object({ items: s.array(s.int()) });
const opts = { seed: 1337, numRuns: 100 };
const Push = s.object({ v: s.int() });
const Nothing = s.object({});

function make(logLimit?: number) {
  return inScope(() => {
    const bag = store(Bag, { items: [] }, logLimit === undefined ? {} : { logLimit });
    const push = transaction(bag, "bag.push", Push, (state, { v }) => ({ items: [...state.items, v] }));
    const clear = transaction(bag, "bag.clear", Nothing, () => ({ items: [] }));
    invariant(bag, (state) => state.items.length <= 5);
    return { bag, push, clear };
  });
}

type Step =
  | { kind: "push"; v: number }
  | { kind: "clear" }
  | { kind: "bad" }
  | { kind: "undo" }
  | { kind: "undoWhere"; yes: boolean };

const stepArb: fc.Arbitrary<Step> = fc.oneof(
  fc.integer({ min: -50, max: 50 }).map((v): Step => ({ kind: "push", v })),
  fc.constant<Step>({ kind: "clear" }),
  fc.constant<Step>({ kind: "bad" }),
  fc.constant<Step>({ kind: "undo" }),
  fc.boolean().map((yes): Step => ({ kind: "undoWhere", yes })),
);

describe("k.sync: head", () => {
  it("head() is 0 for a new store", () => {
    expect(make().bag.head()).toBe(0);
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 20 }), (logLimit) => {
        expect(make(logLimit).bag.head()).toBe(0);
      }),
      opts,
    );
  });

  it("head() rises by exactly one per commit and per undo that undoes, and is unchanged by a refused tx or an undo that does nothing", () => {
    fc.assert(
      fc.property(fc.array(stepArb, { maxLength: 40 }), (steps) => {
        const k = make();
        let expected = 0;
        for (const st of steps) {
          const before = k.bag.head();
          expect(before).toBe(expected);
          let changed: boolean;
          if (st.kind === "push") changed = tx(k.push, { v: st.v }).ok;
          else if (st.kind === "clear") changed = tx(k.clear, {}).ok;
          else if (st.kind === "bad") {
            const payload: unknown = { v: "not an int" };
            changed = tx(k.push, payload).ok;
            expect(changed).toBe(false);
          } else if (st.kind === "undo") changed = k.bag.undo();
          else changed = k.bag.undoWhere(() => st.yes);
          if (changed) expected += 1;
          expect(k.bag.head()).toBe(expected);
        }
      }),
      opts,
    );
  });

  it("a tx refused by an invariant or by its schema leaves head(), state and log unchanged", () => {
    fc.assert(
      fc.property(fc.integer({ min: -50, max: 50 }), (v) => {
        const k = make();
        for (let i = 0; i < 5; i++) expect(tx(k.push, { v }).ok).toBe(true);
        const before = JSON.stringify([k.bag.head(), k.bag.snapshot(), k.bag.log()]);
        const r = tx(k.push, { v });
        expect(r.ok).toBe(false);
        const payload: unknown = { v: null };
        expect(tx(k.push, payload).ok).toBe(false);
        expect(JSON.stringify([k.bag.head(), k.bag.snapshot(), k.bag.log()])).toBe(before);
        expect(k.bag.head()).toBe(5);
      }),
      opts,
    );
  });

  it("each entry's id is the head after its commit, and an undo leaves a gap in ids", () => {
    fc.assert(
      fc.property(fc.array(stepArb, { maxLength: 40 }), (steps) => {
        const k = make();
        for (const st of steps) {
          if (st.kind === "push") {
            if (tx(k.push, { v: st.v }).ok) expect(k.bag.log().at(-1)?.id).toBe(k.bag.head());
          } else if (st.kind === "clear") {
            if (tx(k.clear, {}).ok) expect(k.bag.log().at(-1)?.id).toBe(k.bag.head());
          } else if (st.kind === "undo") k.bag.undo();
          else if (st.kind === "undoWhere") k.bag.undoWhere(() => st.yes);
        }
        const ids = k.bag.log().map((e) => e.id);
        for (let i = 1; i < ids.length; i++) expect(ids[i]).toBeGreaterThan(ids[i - 1] ?? -1);
        for (const id of ids) expect(id).toBeLessThanOrEqual(k.bag.head());
      }),
      opts,
    );
    const k = make();
    tx(k.push, { v: 1 });
    tx(k.push, { v: 2 });
    expect(k.bag.undo()).toBe(true);
    expect(k.bag.head()).toBe(3);
    tx(k.push, { v: 3 });
    expect(k.bag.log().map((e) => e.id)).toEqual([1, 4]);
    expect(k.bag.head()).toBe(4);
  });
});
