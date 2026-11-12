// Spec: k.sync Conformance, "Under `'rebase'`, `tx` with a `base` other than `head()` commits on the current state and the entry holds that `base`; an invariant failure is `store.invariant` and commits nothing."
// Seed 1337 (fast-check `seed: 1337`).
import { s } from "@keel/schema";
import { invariant, store, transaction, tx } from "@keel/store";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { inScope } from "./fixtures";

const Bag = s.object({ items: s.array(s.int()) });
const Push = s.object({ v: s.int() });
const opts = { seed: 1337, numRuns: 100 };
const CAP = 6;

function make() {
  return inScope(() => {
    const bag = store(Bag, { items: [] }, { id: "sync.bag" });
    const push = transaction(bag, "sync.push", Push, (state, { v }) => ({ items: [...state.items, v] }), {
      concurrent: "rebase",
    });
    invariant(bag, (state) => state.items.length <= CAP);
    return { bag, push };
  });
}

const setupArb = fc.record({
  prior: fc.array(fc.integer({ min: -50, max: 50 }), { maxLength: CAP - 1 }),
  v: fc.integer({ min: -50, max: 50 }),
  other: fc.nat({ max: 40 }),
});

describe("k.sync: rebase", () => {
  it("under 'rebase', `tx` with a `base` other than `head()` commits on the current state", () => {
    fc.assert(
      fc.property(setupArb, ({ prior, v, other }) => {
        const k = make();
        for (const p of prior) tx(k.push, { v: p });
        const head = k.bag.head();
        const base = other === head ? head + 1 : other;
        const r = tx(k.push, { v }, { base });
        expect(r.ok).toBe(true);
        expect(k.bag.get("items")).toEqual([...prior, v]);
        expect(k.bag.head()).toBe(head + 1);
      }),
      opts,
    );
  });

  it("the committed entry holds that `base`", () => {
    fc.assert(
      fc.property(setupArb, ({ prior, v, other }) => {
        const k = make();
        for (const p of prior) tx(k.push, { v: p });
        const head = k.bag.head();
        const base = other === head ? head + 1 : other;
        tx(k.push, { v }, { base });
        const entry = k.bag.log().at(-1);
        expect(entry?.base).toBe(base);
        expect(entry?.id).toBe(head + 1);
      }),
      opts,
    );
  });

  it("a rebase `tx` with `base` equal to `head()` commits an entry without `base`", () => {
    const k = make();
    tx(k.push, { v: 1 });
    expect(tx(k.push, { v: 2 }, { base: k.bag.head() }).ok).toBe(true);
    const entry = k.bag.log().at(-1);
    expect(entry !== undefined && "base" in entry).toBe(false);
  });

  it("under 'rebase', an invariant failure is `store.invariant` and commits nothing", () => {
    fc.assert(
      fc.property(fc.integer({ min: -50, max: 50 }), fc.nat({ max: 40 }), (v, other) => {
        const k = make();
        for (let i = 0; i < CAP; i++) tx(k.push, { v: i });
        const head = k.bag.head();
        const base = other === head ? head + 1 : other;
        const before = JSON.stringify([k.bag.snapshot(), k.bag.log(), k.bag.head()]);
        const r = tx(k.push, { v }, { base });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error.code).toBe("store.invariant");
        expect(JSON.stringify([k.bag.snapshot(), k.bag.log(), k.bag.head()])).toBe(before);
      }),
      opts,
    );
  });

  it("under 'rebase', a concurrent payload that fails its schema is `schema.invalid` and commits nothing", () => {
    const k = make();
    tx(k.push, { v: 1 });
    const payload: unknown = { v: "x" };
    const r = tx(k.push, payload, { base: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("schema.invalid");
    expect(k.bag.head()).toBe(1);
  });
});
