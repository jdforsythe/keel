// Spec: k.store, clause "`restore` of a snapshot whose log exceeds `logLimit` keeps its state and its latest `logLimit` entries."
// Seed 1337 (fast-check `seed: 1337`).
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const Bag = s.object({ items: s.array(s.int()) });
const Push = s.object({ v: s.int() });
const Nothing = s.object({});
const opts = { seed: 1337, numRuns: 100 };

type Step = { kind: "push"; v: number } | { kind: "drop" };
const stepArb: fc.Arbitrary<Step> = fc.oneof(
  fc.integer({ min: -50, max: 50 }).map((v): Step => ({ kind: "push", v })),
  fc.constant<Step>({ kind: "drop" }),
);

function inScope<T>(fn: () => T): T {
  const box: { v: { value: T } | undefined } = { v: undefined };
  const sc = scope(() => {
    box.v = { value: fn() };
  });
  if (box.v === undefined) throw new Error("scope body did not run");
  void sc;
  return box.v.value;
}

function make(logLimit: number) {
  return inScope(() => {
    const bag = store(Bag, { items: [] }, { logLimit });
    const push = transaction(bag, "bag.push", Push, (state, { v }) => ({ items: [...state.items, v] }));
    const drop = transaction(bag, "bag.drop", Nothing, (state) => ({ items: state.items.slice(0, -1) }));
    return { bag, push, drop };
  });
}
type Kit = ReturnType<typeof make>;

function run(k: Kit, st: Step) {
  return st.kind === "push" ? tx(k.push, { v: st.v }) : tx(k.drop, {});
}
function replay(k: Kit, entries: ReadonlyArray<{ name: string; payload: unknown }>) {
  for (const e of entries) {
    if (e.name === "bag.push") tx(k.push, e.payload);
    else if (e.name === "bag.drop") tx(k.drop, e.payload);
    else throw new Error(`unknown transaction ${e.name}`);
  }
}

describe("k.store: restore folds a long log to logLimit", () => {
  it("`restore` of a snapshot whose log exceeds `logLimit` keeps its state and its latest `logLimit` entries", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 8 }),
        fc.array(stepArb, { minLength: 9, maxLength: 30 }),
        fc.boolean(),
        (limit, steps, withMeta) => {
          const big = make(100);
          for (const st of steps) run(big, st);
          const snap = big.bag.snapshot({ meta: withMeta });
          expect(snap.log.length).toBe(steps.length);
          const small = make(limit);
          small.bag.restore(snap);
          expect(small.bag.snapshot().state).toEqual(snap.state);
          const log = small.bag.log();
          const want = snap.log.slice(snap.log.length - limit);
          expect(log.length).toBe(limit);
          expect(log.map((e) => [e.id, e.name, e.payload])).toEqual(want.map((e) => [e.id, e.name, e.payload]));
          const after = small.bag.snapshot();
          expect(after.log.length).toBe(limit);
          const fresh = make(limit);
          fresh.bag.restore({ state: after.initial, log: [], initial: after.initial });
          replay(fresh, log);
          expect(fresh.bag.snapshot().state).toEqual(snap.state);
        },
      ),
      opts,
    );
  });

  it("`restore` of a plain `{ state, log, initial }` snapshot of any length within `logLimit` still restores whole", () => {
    fc.assert(
      fc.property(fc.array(stepArb, { maxLength: 20 }), (steps) => {
        const src = make(256);
        for (const st of steps) run(src, st);
        const snap = src.bag.snapshot();
        const plain = { state: snap.state, log: snap.log, initial: snap.initial };
        const dst = make(256);
        dst.bag.restore(plain);
        expect(dst.bag.snapshot().state).toEqual(snap.state);
        expect(dst.bag.log().map((e) => [e.id, e.name, e.payload])).toEqual(
          snap.log.map((e) => [e.id, e.name, e.payload]),
        );
        expect(dst.bag.snapshot().initial).toEqual(snap.initial);
      }),
      opts,
    );
  });
});
