// Spec: k.sync Conformance, bullet 13 "With `logLimit: 0`, a keyed write retried commits once; with `logLimit: 2`, a write keyed `k1` after `k1`, `k2`, `k3` commits nothing under `keyLimit: 8` and commits under `keyLimit: 2`." and bullet 14 "`store` throws for a `keyLimit` of 0, -1 or 1.5; `restore` of a snapshot holding more than `keyLimit` keys keeps the latest `keyLimit`."
// Seed 1337 (fast-check `seed: 1337`).
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { isolate, store, transaction, tx } from "@keel/store";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const Bag = s.object({ items: s.array(s.int()) });
const Push = s.object({ v: s.int() });
const opts = { seed: 1337, numRuns: 100 };

function isolated<T>(fn: () => T): T {
  const sc = scope(() => {});
  isolate(sc);
  return sc.run(fn);
}

function make(limits: { logLimit?: number; keyLimit?: number }) {
  return isolated(() => {
    const bag = store(Bag, { items: [] }, { id: "sync.keylimit", ...limits });
    const push = transaction(bag, "sync.push", Push, (state, { v }) => ({ items: [...state.items, v] }));
    return { bag, push };
  });
}

/** `keys` read from untyped JSON. */
function keysOf(snap: unknown): unknown {
  const raw: { keys?: unknown } = JSON.parse(JSON.stringify(snap));
  return raw.keys;
}

const keyArb = fc.stringMatching(/^[a-z0-9-]{1,16}$/);

describe("k.sync: keyLimit", () => {
  it("with `logLimit: 0`, a keyed write retried commits once", () => {
    fc.assert(
      fc.property(keyArb, fc.integer({ min: 1, max: 5 }), (key, retries) => {
        const k = make({ logLimit: 0 });
        for (let i = 0; i <= retries; i++) expect(tx(k.push, { v: 1 }, { key }).ok).toBe(true);
        expect(k.bag.get("items")).toEqual([1]);
        expect(k.bag.head()).toBe(1);
      }),
      opts,
    );
  });

  it("with `logLimit: 2`, a write keyed `k1` after `k1`, `k2`, `k3` commits nothing under `keyLimit: 8`", () => {
    const k = make({ logLimit: 2, keyLimit: 8 });
    for (const key of ["k1", "k2", "k3"]) tx(k.push, { v: 1 }, { key });
    expect(tx(k.push, { v: 2 }, { key: "k1" }).ok).toBe(true);
    expect(k.bag.get("items")).toEqual([1, 1, 1]);
    expect(k.bag.head()).toBe(3);
  });

  it("with `logLimit: 2`, a write keyed `k1` after `k1`, `k2`, `k3` commits under `keyLimit: 2`", () => {
    const k = make({ logLimit: 2, keyLimit: 2 });
    for (const key of ["k1", "k2", "k3"]) tx(k.push, { v: 1 }, { key });
    expect(tx(k.push, { v: 2 }, { key: "k1" }).ok).toBe(true);
    expect(k.bag.get("items")).toEqual([1, 1, 1, 2]);
    expect(k.bag.head()).toBe(4);
  });

  it("the default `keyLimit` is 1024: the oldest of 1025 keys is forgotten, the next oldest is not", () => {
    const k = make({ logLimit: 0 });
    for (let i = 0; i < 1025; i++) tx(k.push, { v: i }, { key: `k${i}` });
    expect(k.bag.head()).toBe(1025);
    tx(k.push, { v: -1 }, { key: "k1" });
    expect(k.bag.head()).toBe(1025);
    tx(k.push, { v: -2 }, { key: "k0" });
    expect(k.bag.head()).toBe(1026);
  });

  it("a key is forgotten once `keyLimit` later keyed commits have passed it, whatever `logLimit` is", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 6 }), fc.integer({ min: 0, max: 6 }), (keyLimit, logLimit) => {
        const k = make({ logLimit, keyLimit });
        tx(k.push, { v: 0 }, { key: "first" });
        for (let i = 0; i < keyLimit - 1; i++) tx(k.push, { v: 1 }, { key: `n${i}` });
        const held = k.bag.head();
        tx(k.push, { v: 2 }, { key: "first" });
        expect(k.bag.head()).toBe(held);
        tx(k.push, { v: 3 }, { key: "last" });
        const after = k.bag.head();
        tx(k.push, { v: 4 }, { key: "first" });
        expect(k.bag.head()).toBe(after + 1);
      }),
      opts,
    );
  });

  it("`snapshot()` holds at most `keyLimit` keys, the latest, oldest first", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        fc.uniqueArray(keyArb, { minLength: 0, maxLength: 10 }),
        (keyLimit, keys) => {
          const k = make({ keyLimit });
          for (const key of keys) tx(k.push, { v: 1 }, { key });
          const held = keysOf(k.bag.snapshot());
          expect(held).toEqual(keys.map((key) => ({ name: "sync.push", key })).slice(-keyLimit));
        },
      ),
      opts,
    );
  });

  it("`store` throws for a `keyLimit` of 0", () => {
    expect(() => make({ keyLimit: 0 })).toThrow();
  });

  it("`store` throws for a `keyLimit` of -1", () => {
    expect(() => make({ keyLimit: -1 })).toThrow();
  });

  it("`store` throws for a `keyLimit` of 1.5", () => {
    expect(() => make({ keyLimit: 1.5 })).toThrow();
  });

  it("`store` throws for any `keyLimit` that is not a positive integer", () => {
    const bad = fc.oneof(
      fc.integer({ min: -1000, max: 0 }),
      fc.double({ noNaN: true, noInteger: true, min: -1000, max: 1000 }),
      fc.constant(Number.NaN),
    );
    fc.assert(
      fc.property(bad, (keyLimit) => {
        expect(() => make({ keyLimit })).toThrow();
      }),
      opts,
    );
  });

  it("`store` accepts any positive integer `keyLimit`", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5000 }), (keyLimit) => {
        expect(() => make({ keyLimit })).not.toThrow();
      }),
      opts,
    );
  });

  it("`restore` of a snapshot holding more than `keyLimit` keys keeps the latest `keyLimit`", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 4 }),
        fc.uniqueArray(keyArb, { minLength: 5, maxLength: 10 }),
        (keyLimit, keys) => {
          const src = make({ keyLimit: 16 });
          for (const key of keys) tx(src.push, { v: 1 }, { key });
          const snap = JSON.parse(JSON.stringify(src.bag.snapshot()));
          const dst = make({ keyLimit });
          expect(dst.bag.restore(snap).ok).toBe(true);
          expect(keysOf(dst.bag.snapshot())).toEqual(keys.map((key) => ({ name: "sync.push", key })).slice(-keyLimit));
        },
      ),
      opts,
    );
  });
});
