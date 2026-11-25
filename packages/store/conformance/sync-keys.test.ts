// Spec: k.sync, clause "The same `key` on another transaction commits; a `key` whose entry `undo` removed, or that folded out of the log, still commits nothing, and commits again once `keyLimit` later commits with a `key` have passed it."
// Spec: k.sync, clause "`keys` survives `snapshot()`, a JSON round trip and `restore`; a snapshot without `keys` restores its log entries' keys."
// Seed 1337 (fast-check `seed: 1337`).
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { isolate, store, transaction, tx } from "@keel/store";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const Bag = s.object({ items: s.array(s.int()) });
const Push = s.object({ v: s.int() });
const Tokened = s.object({ token: s.secret(s.string()), v: s.int() });
const opts = { seed: 1337, numRuns: 100 };

function isolated<T>(fn: () => T): T {
  const sc = scope(() => {});
  isolate(sc);
  return sc.run(fn);
}

function make(limits: { logLimit?: number; keyLimit?: number } = {}) {
  return isolated(() => {
    const bag = store(Bag, { items: [] }, { id: "sync.keys", ...limits });
    const push = transaction(bag, "sync.push", Push, (state, { v }) => ({ items: [...state.items, v] }));
    const other = transaction(bag, "sync.other", Push, (state, { v }) => ({ items: [...state.items, v * 10] }));
    const sealedPush = transaction(bag, "sync.sealed", Tokened, (state, { v }) => ({ items: [...state.items, v] }));
    return { bag, push, other, sealedPush };
  });
}

/** `keys` read from untyped JSON, so the file holds before the field is in the `Snapshot` type. */
function keysOf(snap: unknown): unknown {
  const raw: { keys?: unknown } = JSON.parse(JSON.stringify(snap));
  return raw.keys;
}

/** A snapshot as JSON with `keys` removed, as an older writer stored it. */
function withoutKeys(snap: unknown): Record<string, unknown> {
  const raw: Record<string, unknown> = JSON.parse(JSON.stringify(snap));
  delete raw.keys;
  return raw;
}

const keyArb = fc.stringMatching(/^[a-z0-9-]{1,64}$/);
const keysArb = fc.uniqueArray(keyArb, { minLength: 0, maxLength: 8 });

describe("k.sync: keys", () => {
  it("the same `key` on a second transaction of the store commits", () => {
    fc.assert(
      fc.property(keyArb, (key) => {
        const k = make();
        expect(tx(k.push, { v: 1 }, { key }).ok).toBe(true);
        expect(tx(k.other, { v: 2 }, { key }).ok).toBe(true);
        expect(k.bag.get("items")).toEqual([1, 20]);
        expect(k.bag.head()).toBe(2);
        expect(tx(k.other, { v: 3 }, { key }).ok).toBe(true);
        expect(k.bag.get("items")).toEqual([1, 20]);
      }),
      opts,
    );
  });

  it("`keys` holds at most `keyLimit` pairs, oldest first, from keyed commits only", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5 }), keysArb, (limit, keys) => {
        const k = make({ keyLimit: limit });
        keys.forEach((key, i) => {
          tx(k.push, { v: i }, { key });
          tx(k.push, { v: 100 + i });
        });
        const expected = keys.map((key) => ({ name: "sync.push", key })).slice(-limit);
        expect(keysOf(k.bag.snapshot())).toEqual(expected);
        expect(keysOf(k.bag.snapshot({ meta: true }))).toEqual(expected);
      }),
      opts,
    );
  });

  it("`keys` is `[]` when no commit has a `key`", () => {
    const k = make();
    tx(k.push, { v: 1 });
    expect(keysOf(k.bag.snapshot())).toEqual([]);
  });

  it("`restore(JSON.parse(JSON.stringify(snapshot())))` keeps `keys`, and a matching retry on the restored store commits nothing", () => {
    fc.assert(
      fc.property(keysArb, (keys) => {
        const src = make();
        keys.forEach((key, i) => {
          tx(src.push, { v: i }, { key });
        });
        const snap = JSON.parse(JSON.stringify(src.bag.snapshot()));
        const dst = make();
        expect(dst.bag.restore(snap).ok).toBe(true);
        expect(keysOf(dst.bag.snapshot())).toEqual(keys.map((key) => ({ name: "sync.push", key })));
        const before = JSON.stringify(dst.bag.snapshot());
        for (const key of keys) expect(tx(dst.push, { v: 999 }, { key }).ok).toBe(true);
        expect(JSON.stringify(dst.bag.snapshot())).toBe(before);
      }),
      opts,
    );
  });

  it("a snapshot without `keys` restores its log entries' keys", () => {
    fc.assert(
      fc.property(keysArb, (keys) => {
        const src = make();
        keys.forEach((key, i) => {
          tx(src.push, { v: i }, { key });
          tx(src.other, { v: i });
        });
        const bare = withoutKeys(src.bag.snapshot());
        const dst = make();
        expect(dst.bag.restore(bare).ok).toBe(true);
        expect(keysOf(dst.bag.snapshot())).toEqual(keys.map((key) => ({ name: "sync.push", key })));
        const before = JSON.stringify(dst.bag.snapshot());
        for (const key of keys) expect(tx(dst.push, { v: 999 }, { key }).ok).toBe(true);
        expect(JSON.stringify(dst.bag.snapshot())).toBe(before);
      }),
      opts,
    );
  });

  it("a snapshot without `keys` restores only the latest `keyLimit` keys", () => {
    const src = make();
    for (const key of ["a", "b", "c"]) tx(src.push, { v: 1 }, { key });
    const bare = withoutKeys(src.bag.snapshot());
    const dst = make({ keyLimit: 2 });
    expect(dst.bag.restore(bare).ok).toBe(true);
    expect(keysOf(dst.bag.snapshot())).toEqual([
      { name: "sync.push", key: "b" },
      { name: "sync.push", key: "c" },
    ]);
  });

  it("an entry whose payload holds an `s.secret` folds out of `snapshot()` and its key stays in `keys`", () => {
    const k = make();
    const p = Tokened.parse({ token: "tok-abcdefgh", v: 1 });
    if (!p.ok) throw new Error("secret payload did not parse");
    expect(tx(k.sealedPush, p.value, { key: "sec" }).ok).toBe(true);
    const snap = k.bag.snapshot();
    expect(snap.log.length).toBe(0);
    expect(keysOf(snap)).toEqual([{ name: "sync.sealed", key: "sec" }]);
    const dst = make();
    expect(dst.bag.restore(JSON.parse(JSON.stringify(snap))).ok).toBe(true);
    const again = Tokened.parse({ token: "tok-zzzzzzzz", v: 2 });
    if (!again.ok) throw new Error("secret payload did not parse");
    expect(tx(dst.sealedPush, again.value, { key: "sec" }).ok).toBe(true);
    expect(dst.bag.get("items")).toEqual([1]);
  });

  it("a `keys` of the wrong shape is `restore`'s `schema.invalid`", () => {
    const wrong: readonly unknown[] = [
      1,
      "x",
      null,
      {},
      [1],
      [{ name: "sync.push" }],
      [{ key: "a" }],
      [{ name: 1, key: "a" }],
      [{ name: "sync.push", key: 1 }],
      [{ name: "sync.push", key: "" }],
    ];
    const src = make();
    tx(src.push, { v: 1 });
    const base = withoutKeys(src.bag.snapshot());
    for (const keys of wrong) {
      const dst = make();
      const r = dst.bag.restore({ ...base, keys });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe("schema.invalid");
    }
  });
});
