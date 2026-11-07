// Spec: k.store, clause "After more than `logLimit` commits, `log()` holds the latest `logLimit` entries, replaying them from `snapshot().initial` reproduces state, and `undo()` returns `true` exactly `logLimit` times."
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

function make(initial: { items: number[] }, logLimit?: number) {
  return inScope(() => {
    const options = logLimit === undefined ? {} : { logLimit };
    const bag = store(Bag, initial, options);
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

function checkLimit(steps: Step[], limit: number | undefined) {
  const effective = limit ?? 256;
  const k = make({ items: [] }, limit);
  for (const st of steps) run(k, st);
  const kept = Math.min(steps.length, effective);
  const log = k.bag.log();
  expect(log.length).toBe(kept);
  // the kept entries are the latest ones, in order
  const twin = make({ items: [] }); // unbounded-enough twin (default 256 >= steps)
  for (const st of steps) run(twin, st);
  const all = twin.bag.log();
  expect(log.map((e) => [e.name, e.payload])).toEqual(all.slice(all.length - kept).map((e) => [e.name, e.payload]));
  const snap = k.bag.snapshot();
  expect(snap.state).toEqual(twin.bag.snapshot().state);
  // replay from initial reproduces state
  const fresh = make({ items: [...snap.initial.items] }, limit);
  replay(fresh, log);
  expect(fresh.bag.snapshot().state).toEqual(snap.state);
  // undo true exactly `kept` times
  const before = k.bag.snapshot();
  for (let i = 0; i < kept; i++) expect(k.bag.undo()).toBe(true);
  expect(k.bag.snapshot().state).toEqual(before.initial);
  const afterState = JSON.stringify(k.bag.snapshot());
  expect(k.bag.undo()).toBe(false);
  expect(k.bag.undoWhere(() => true)).toBe(false);
  expect(JSON.stringify(k.bag.snapshot())).toBe(afterState);
  expect(k.bag.log().length).toBe(0);
}

describe("k.store: log limit", () => {
  it("After more than `logLimit` commits, `log()` holds the latest `logLimit` entries, replay from `snapshot().initial` reproduces state, `undo()` is true exactly `logLimit` times (limits 0..8)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 8 }),
        fc.array(stepArb, { minLength: 9, maxLength: 30 }),
        (limit, steps) => {
          expect(steps.length).toBeGreaterThan(limit);
          checkLimit(steps, limit);
        },
      ),
      opts,
    );
  });

  it("A log not exceeding `logLimit` is kept whole (limits 0..8, commit counts up to the limit)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 8 }), fc.array(stepArb, { maxLength: 8 }), (limit, steps) => {
        fc.pre(steps.length <= limit);
        checkLimit(steps, limit);
      }),
      opts,
    );
  });

  it("`logLimit` defaults to 256: after 300 commits `log()` holds the latest 256 and `undo()` is true exactly 256 times", () => {
    const steps: Step[] = Array.from({ length: 300 }, (_, i): Step => ({ kind: "push", v: i }));
    checkLimit(steps, undefined);
    const k = make({ items: [] });
    for (const st of steps) run(k, st);
    expect(k.bag.log().length).toBe(256);
  });

  it("`store` throws when `logLimit` is not a non-negative integer (-1, 1.5, NaN, Infinity)", () => {
    for (const bad of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, -0.5]) {
      expect(() => make({ items: [] }, bad)).toThrow();
    }
  });

  it("`store` accepts `logLimit` 0: nothing is kept, state still changes, `undo()` is false", () => {
    const k = make({ items: [] }, 0);
    tx(k.push, { v: 1 });
    tx(k.push, { v: 2 });
    expect(k.bag.log().length).toBe(0);
    expect(k.bag.snapshot().state).toEqual({ items: [1, 2] });
    expect(k.bag.snapshot().initial).toEqual({ items: [1, 2] });
    expect(k.bag.undo()).toBe(false);
    expect(k.bag.snapshot().state).toEqual({ items: [1, 2] });
  });
});
