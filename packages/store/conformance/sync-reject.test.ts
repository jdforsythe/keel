// Spec: k.sync Conformance, "Under `'reject'`, `tx` with a `base` other than `head()` returns `err` `keel.conflict` with data `{ store, transaction, base, head }` and changes nothing; with `base` equal to `head()` it commits an entry without `base`."
// Seed 1337 (fast-check `seed: 1337`).
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { isolate, store, transaction, tx } from "@keel/store";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const Bag = s.object({ items: s.array(s.int()) });
const Push = s.object({ v: s.int() });
const opts = { seed: 1337, numRuns: 100 };

/** Run `fn` in a scope with its own registry, so each store of one id lives apart (scope left open: callers use the stores after return). */
function isolated<T>(fn: () => T): T {
  const sc = scope(() => {});
  isolate(sc);
  return sc.run(fn);
}

function make(explicit: boolean) {
  return isolated(() => {
    const bag = store(Bag, { items: [] }, { id: "sync.bag" });
    const fn = (state: { items: number[] }, { v }: { v: number }) => ({ items: [...state.items, v] });
    const push = explicit
      ? transaction(bag, "sync.push", Push, fn, { concurrent: "reject" })
      : transaction(bag, "sync.push", Push, fn);
    return { bag, push };
  });
}

const setupArb = fc.record({
  explicit: fc.boolean(),
  prior: fc.array(fc.integer({ min: -50, max: 50 }), { maxLength: 8 }),
  v: fc.integer({ min: -50, max: 50 }),
  other: fc.nat({ max: 40 }),
});

describe("k.sync: reject", () => {
  it("under 'reject', `tx` with a `base` other than `head()` returns `err` `keel.conflict` with data `{ store, transaction, base, head }`", () => {
    fc.assert(
      fc.property(setupArb, ({ explicit, prior, v, other }) => {
        const k = make(explicit);
        for (const p of prior) tx(k.push, { v: p });
        const head = k.bag.head();
        const base = other === head ? head + 1 : other;
        const r = tx(k.push, { v }, { base });
        expect(r.ok).toBe(false);
        if (!r.ok) {
          expect(r.error.code).toBe("keel.conflict");
          expect(r.error.data).toEqual({ store: "sync.bag", transaction: "sync.push", base, head });
        }
      }),
      opts,
    );
  });

  it("a conflicting `tx` changes nothing: state, log, snapshot and `head()` are as before", () => {
    fc.assert(
      fc.property(setupArb, ({ explicit, prior, v, other }) => {
        const k = make(explicit);
        for (const p of prior) tx(k.push, { v: p });
        const head = k.bag.head();
        const base = other === head ? head + 1 : other;
        const before = JSON.stringify([k.bag.snapshot({ meta: true }), k.bag.log(), k.bag.head()]);
        expect(tx(k.push, { v }, { base }).ok).toBe(false);
        expect(JSON.stringify([k.bag.snapshot({ meta: true }), k.bag.log(), k.bag.head()])).toBe(before);
        expect(k.bag.head()).toBe(head);
      }),
      opts,
    );
  });

  it("under 'reject', `tx` with `base` equal to `head()` commits an entry without `base`", () => {
    fc.assert(
      fc.property(setupArb, ({ explicit, prior, v }) => {
        const k = make(explicit);
        for (const p of prior) tx(k.push, { v: p });
        const head = k.bag.head();
        const r = tx(k.push, { v }, { base: head });
        expect(r.ok).toBe(true);
        expect(k.bag.head()).toBe(head + 1);
        const entry = k.bag.log().at(-1);
        expect(entry?.id).toBe(head + 1);
        expect(entry !== undefined && "base" in entry).toBe(false);
        expect(k.bag.get("items")).toEqual([...prior, v]);
      }),
      opts,
    );
  });

  it("a `base` of 0 on a new store is not concurrent", () => {
    const k = make(false);
    expect(tx(k.push, { v: 1 }, { base: 0 }).ok).toBe(true);
    expect(tx(k.push, { v: 2 }, { base: 0 }).ok).toBe(false);
  });
});
