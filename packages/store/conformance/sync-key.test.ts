// Spec: k.sync, clause "`tx` with a `key` that `keys` holds for its transaction returns `ok`, commits nothing and leaves `head()` unchanged, also when its `base` is stale."
// Spec: k.sync, clause "The same `key` on another transaction commits; a `key` whose entry `undo` removed, or that folded out of the log, still commits nothing, and commits again once `keyLimit` later commits with a `key` have passed it."
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

function make(concurrent: "reject" | "rebase", limits: { logLimit?: number; keyLimit?: number } = {}) {
  return isolated(() => {
    const bag = store(Bag, { items: [] }, { id: "sync.bag", ...limits });
    const push = transaction(bag, "sync.push", Push, (state, { v }) => ({ items: [...state.items, v] }), {
      concurrent,
    });
    return { bag, push };
  });
}

const keyArb = fc.stringMatching(/^[a-z0-9-]{1,64}$/);
const modeArb = fc.constantFrom<"reject" | "rebase">("reject", "rebase");

describe("k.sync: key", () => {
  it("`tx` with a `key` that `keys` holds for its transaction returns `ok`, commits nothing and leaves `head()` unchanged, also when its `base` is stale", () => {
    fc.assert(
      fc.property(
        modeArb,
        keyArb,
        fc.integer({ min: -50, max: 50 }),
        fc.integer({ min: -50, max: 50 }),
        (mode, key, a, b) => {
          const k = make(mode);
          expect(tx(k.push, { v: a }, { key }).ok).toBe(true);
          const before = JSON.stringify([k.bag.snapshot({ meta: true }), k.bag.log(), k.bag.head()]);
          const again = tx(k.push, { v: b }, { key });
          expect(again.ok).toBe(true);
          expect(JSON.stringify([k.bag.snapshot({ meta: true }), k.bag.log(), k.bag.head()])).toBe(before);
          expect(k.bag.get("items")).toEqual([a]);
          expect(k.bag.head()).toBe(1);
        },
      ),
      opts,
    );
  });

  it("a repeated `key` also returns `ok` when its `base` is stale, under 'reject' and 'rebase'", () => {
    fc.assert(
      fc.property(
        modeArb,
        keyArb,
        fc.array(fc.integer({ min: -50, max: 50 }), { minLength: 1, maxLength: 6 }),
        (mode, key, more) => {
          const k = make(mode);
          expect(tx(k.push, { v: 0 }, { key, base: 0 }).ok).toBe(true);
          for (const v of more) tx(k.push, { v });
          const head = k.bag.head();
          const before = JSON.stringify([k.bag.snapshot(), k.bag.log()]);
          const r = tx(k.push, { v: 99 }, { key, base: 0 });
          expect(r.ok).toBe(true);
          expect(k.bag.head()).toBe(head);
          expect(JSON.stringify([k.bag.snapshot(), k.bag.log()])).toBe(before);
        },
      ),
      opts,
    );
  });

  it("`key` is checked before `base`: a stale `base` with a held `key` is not `keel.conflict` under 'reject'", () => {
    const k = make("reject");
    expect(tx(k.push, { v: 1 }, { key: "k1" }).ok).toBe(true);
    expect(tx(k.push, { v: 2 }).ok).toBe(true);
    expect(tx(k.push, { v: 3 }, { base: 0 }).ok).toBe(false);
    expect(tx(k.push, { v: 3 }, { key: "k1", base: 0 }).ok).toBe(true);
    expect(k.bag.get("items")).toEqual([1, 2]);
  });

  it("the entry keeps its `key`", () => {
    fc.assert(
      fc.property(keyArb, (key) => {
        const k = make("reject");
        tx(k.push, { v: 1 }, { key });
        expect(k.bag.log().at(-1)?.key).toBe(key);
      }),
      opts,
    );
  });

  it("a different `key`, or no `key`, commits as usual", () => {
    const k = make("reject");
    tx(k.push, { v: 1 }, { key: "a" });
    expect(tx(k.push, { v: 2 }, { key: "b" }).ok).toBe(true);
    expect(tx(k.push, { v: 3 }).ok).toBe(true);
    expect(k.bag.get("items")).toEqual([1, 2, 3]);
    expect(k.bag.head()).toBe(3);
  });

  it("a `key` whose entry `undo` removed, or that folded out of the log, still commits nothing, and commits again once `keyLimit` later commits with a `key` have passed it", () => {
    const k = make("reject");
    tx(k.push, { v: 1 }, { key: "u" });
    expect(k.bag.undo()).toBe(true);
    expect(tx(k.push, { v: 2 }, { key: "u" }).ok).toBe(true);
    expect(k.bag.get("items")).toEqual([]);
    const f = make("reject", { logLimit: 1, keyLimit: 1 });
    tx(f.push, { v: 1 }, { key: "f" });
    tx(f.push, { v: 2 });
    expect(f.bag.log().length).toBe(1);
    expect(tx(f.push, { v: 3 }, { key: "f" }).ok).toBe(true);
    expect(f.bag.get("items")).toEqual([1, 2]);
    expect(tx(f.push, { v: 4 }, { key: "g" }).ok).toBe(true);
    expect(tx(f.push, { v: 5 }, { key: "f" }).ok).toBe(true);
    expect(f.bag.get("items")).toEqual([1, 2, 4, 5]);
    const d = make("reject", { logLimit: 1 });
    tx(d.push, { v: 1 }, { key: "f" });
    tx(d.push, { v: 2 });
    tx(d.push, { v: 3 }, { key: "g" });
    expect(tx(d.push, { v: 4 }, { key: "f" }).ok).toBe(true);
    expect(d.bag.get("items")).toEqual([1, 2, 3]);
  });

  it("a `base` or `key` of the wrong type is `schema.invalid` and commits nothing", () => {
    // JSON.parse yields untyped options, standing in for a caller that bypasses the types.
    const wrong: readonly unknown[] = [1, 0, null, true, {}, [], "x", -1.5];
    const k = make("rebase");
    tx(k.push, { v: 1 });
    for (const key of wrong.filter((w) => typeof w !== "string")) {
      const r = tx(k.push, { v: 2 }, JSON.parse(JSON.stringify({ key })));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe("schema.invalid");
    }
    for (const base of wrong.filter((w) => typeof w !== "number")) {
      const r = tx(k.push, { v: 2 }, JSON.parse(JSON.stringify({ base })));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe("schema.invalid");
    }
    expect(k.bag.head()).toBe(1);
    expect(k.bag.get("items")).toEqual([1]);
  });
});
