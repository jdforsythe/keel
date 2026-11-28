// k.store, clause "`snapshotKeys(snapshot)` gives the write keys a `restore` of `snapshot` takes: its `keys` when present, `[]` included (then no key, whatever its log holds), else, when `keys` is absent, its log entries' keys in log order (k.sync)."
// Seed 1337 (fast-check `seed: 1337`).
// Reading: the "write keys" are the `{ name, key }` pairs `snapshot().keys` holds (k.sync Write key), so a log entry yields `{ name, key }` of its own name and key, and an entry committed without a `key` yields none. A snapshot "without `keys`" is one whose `keys` property is absent; one holding `[]` has keys, so gives `[]`.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { isolate, snapshotKeys, store, transaction, tx } from "@keel/store";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const Bag = s.object({ items: s.array(s.int()) });
const Push = s.object({ v: s.int() });
const opts = { seed: 1337, numRuns: 100 };

function isolated<T>(fn: () => T): T {
  const sc = scope(() => {}, { detached: true });
  isolate(sc);
  return sc.run(fn);
}

function make(limits: { logLimit?: number; keyLimit?: number } = {}) {
  return isolated(() => {
    const bag = store(Bag, { items: [] }, { id: "pure.keys", ...limits });
    const push = transaction(bag, "pure.push", Push, (state, { v }) => ({ items: [...state.items, v] }));
    const other = transaction(bag, "pure.other", Push, (state, { v }) => ({ items: [...state.items, v * 10] }));
    return { bag, push, other };
  });
}

const keyArb = fc.stringMatching(/^[a-z0-9-]{1,64}$/);
/** Each write: which transaction, and a key or none. */
const writesArb = fc.array(
  fc.record({ which: fc.constantFrom("push" as const, "other" as const), key: fc.option(keyArb, { nil: undefined }) }),
  { minLength: 0, maxLength: 10 },
);
const distinctKeys = (ws: readonly { which: string; key: string | undefined }[]): boolean => {
  const seen = new Set<string>();
  for (const w of ws) {
    if (w.key === undefined) continue;
    const id = `${w.which}/${w.key}`;
    if (seen.has(id)) return false;
    seen.add(id);
  }
  return true;
};

describe("k.store: snapshotKeys", () => {
  it("gives the snapshot's `keys`: each keyed commit's name and key, oldest first", () => {
    fc.assert(
      fc.property(writesArb.filter(distinctKeys), (writes) => {
        const k = make();
        for (const [i, w] of writes.entries()) {
          const t = w.which === "push" ? k.push : k.other;
          tx(t, { v: i }, w.key === undefined ? undefined : { key: w.key });
        }
        const expected = writes.flatMap((w) =>
          w.key === undefined ? [] : [{ name: w.which === "push" ? "pure.push" : "pure.other", key: w.key }],
        );
        expect(snapshotKeys(k.bag.snapshot())).toEqual(expected);
        expect(snapshotKeys(k.bag.snapshot({ meta: true }))).toEqual(expected);
      }),
      opts,
    );
  });

  it("gives `keys`, not the log's, when the snapshot holds `keys`: an undone write's key stays, and an empty `keys` gives none", () => {
    fc.assert(
      fc.property(keyArb, keyArb, (a, b) => {
        const k = make();
        tx(k.push, { v: 1 }, { key: a });
        tx(k.other, { v: 2 }, { key: b });
        k.bag.undo();
        const snap = k.bag.snapshot();
        expect(snap.log.length).toBe(1);
        expect(snapshotKeys(snap)).toEqual([
          { name: "pure.push", key: a },
          { name: "pure.other", key: b },
        ]);
        expect(snapshotKeys({ ...snap, keys: [] })).toEqual([]);
      }),
      opts,
    );
  });

  it("gives `[]` for a snapshot whose `keys` is `[]`, whatever its log holds", () => {
    fc.assert(
      fc.property(writesArb.filter(distinctKeys), (writes) => {
        const k = make();
        for (const [i, w] of writes.entries()) {
          const t = w.which === "push" ? k.push : k.other;
          tx(t, { v: i }, w.key === undefined ? undefined : { key: w.key });
        }
        const snap = k.bag.snapshot();
        expect(snapshotKeys({ ...snap, keys: [] })).toEqual([]);
        expect(snapshotKeys({ ...snap, keys: [] }).length).toBe(0);
        expect({ ...snap, keys: [] }.log.length).toBe(k.bag.log().length);
      }),
      opts,
    );
  });

  it("gives its log entries' keys in log order when the snapshot has no `keys`, and none for an entry committed without a `key`", () => {
    fc.assert(
      fc.property(writesArb.filter(distinctKeys), (writes) => {
        const k = make();
        for (const [i, w] of writes.entries()) {
          const t = w.which === "push" ? k.push : k.other;
          tx(t, { v: i }, w.key === undefined ? undefined : { key: w.key });
        }
        const snap = { ...k.bag.snapshot() };
        Reflect.deleteProperty(snap, "keys");
        const expected = writes.flatMap((w) =>
          w.key === undefined ? [] : [{ name: w.which === "push" ? "pure.push" : "pure.other", key: w.key }],
        );
        expect(snapshotKeys(snap)).toEqual(expected);
      }),
      opts,
    );
  });

  it("is a pure read: it changes neither the snapshot nor the store, and is what a `restore` of the snapshot takes", () => {
    fc.assert(
      fc.property(writesArb.filter(distinctKeys), (writes) => {
        const k = make();
        for (const [i, w] of writes.entries())
          tx(w.which === "push" ? k.push : k.other, { v: i }, w.key === undefined ? undefined : { key: w.key });
        const snap = k.bag.snapshot();
        const before = JSON.stringify(snap);
        const taken = snapshotKeys(snap);
        expect(JSON.stringify(snap)).toBe(before);
        expect(JSON.stringify(k.bag.snapshot())).toBe(before);
        const twin = make();
        twin.bag.restore(snap);
        expect(snapshotKeys(twin.bag.snapshot())).toEqual(taken);
      }),
      opts,
    );
  });
});
