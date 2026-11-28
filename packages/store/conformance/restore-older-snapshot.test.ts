// Spec: k.persist, clause "`restore` of a snapshot whose log names an undeclared transaction returns `ok`, keeps `state` and `head()`, and leaves `log()` empty and `snapshot().initial` equal to `state`."
// Seed: 1337.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import fc from "fast-check";
import { expect, it } from "vitest";

const Bag = s.object({ items: s.array(s.int()) });
const Push = s.object({ v: s.int() });
const Nothing = s.object({});
const opts = { seed: 1337, numRuns: 100 };

function inScope<T>(fn: () => T): T {
  const box: { v: { value: T } | undefined } = { v: undefined };
  const sc = scope(
    () => {
      box.v = { value: fn() };
    },
    { detached: true },
  );
  if (box.v === undefined) throw new Error("scope body did not run");
  void sc;
  return box.v.value;
}

// The code that wrote the snapshot declares `bag.push` and `bag.drop`; the code that reads it declares only `bag.push`.
function writer() {
  return inScope(() => {
    const bag = store(Bag, { items: [] });
    const push = transaction(bag, "bag.push", Push, (state, { v }) => ({ items: [...state.items, v] }));
    const drop = transaction(bag, "bag.drop", Nothing, (state) => ({ items: state.items.slice(0, -1) }));
    return { bag, push, drop };
  });
}
function reader() {
  return inScope(() => {
    const bag = store(Bag, { items: [] });
    const push = transaction(bag, "bag.push", Push, (state, { v }) => ({ items: [...state.items, v] }));
    return { bag, push };
  });
}

const stepArb = fc.oneof(
  fc.integer({ min: -50, max: 50 }).map((v) => ({ kind: "push" as const, v })),
  fc.constant({ kind: "drop" as const }),
);

it("`restore` of a snapshot whose log names an undeclared transaction returns `ok`, keeps `state` and `head()`, and leaves `log()` empty and `snapshot().initial` equal to `state`", () => {
  fc.assert(
    fc.property(
      fc.array(stepArb, { minLength: 0, maxLength: 12 }),
      fc.array(fc.integer({ min: -50, max: 50 }), { maxLength: 4 }),
      (steps, tail) => {
        const w = writer();
        for (const st of steps) {
          if (st.kind === "push") tx(w.push, { v: st.v });
          else tx(w.drop, {});
        }
        // The log names `bag.drop` at least once.
        tx(w.push, { v: 0 });
        tx(w.drop, {});
        for (const v of tail) tx(w.push, { v });
        const snap: unknown = JSON.parse(JSON.stringify(w.bag.snapshot()));

        const r = reader();
        const res = r.bag.restore(snap);
        expect(res.ok).toBe(true);
        expect(r.bag.get("items")).toEqual(w.bag.get("items"));
        expect(r.bag.head()).toBe(w.bag.head());
        expect(r.bag.log()).toEqual([]);
        expect(r.bag.snapshot().initial).toEqual(r.bag.snapshot().state);
        expect(r.bag.snapshot().state).toEqual({ items: w.bag.get("items") });
        // The restored store keeps working from there.
        expect(tx(r.push, { v: 1 }).ok).toBe(true);
        expect(r.bag.head()).toBe(w.bag.head() + 1);
      },
    ),
    opts,
  );

  // A payload its schema refuses is handled the same way (k.persist Older snapshots).
  fc.assert(
    fc.property(fc.array(fc.integer({ min: -50, max: 50 }), { minLength: 1, maxLength: 6 }), (vs) => {
      const w = writer();
      for (const v of vs) tx(w.push, { v });
      const snap = w.bag.snapshot();
      const bad = { ...snap, log: snap.log.map((e) => ({ ...e, payload: { v: "not an int" } })) };
      const r = reader();
      expect(r.bag.restore(bad).ok).toBe(true);
      expect(r.bag.get("items")).toEqual(w.bag.get("items"));
      expect(r.bag.head()).toBe(w.bag.head());
      expect(r.bag.log()).toEqual([]);
      expect(r.bag.snapshot().initial).toEqual(r.bag.snapshot().state);
    }),
    opts,
  );

  // A state the schema refuses stays `restore`'s `err`.
  const w = writer();
  const refused = { ...w.bag.snapshot(), state: { items: "nope" } };
  expect(reader().bag.restore(refused).ok).toBe(false);
});
