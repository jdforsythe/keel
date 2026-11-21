// Spec: k.sync Conformance, "`restore(snapshot())` keeps `head()`; a snapshot without `head` restores its latest entry's `id`, else 0; folding past `logLimit` or a secret leaves `head()` unchanged."
// Seed 1337 (fast-check `seed: 1337`).
import { s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { inScope } from "./fixtures";

const Bag = s.object({ items: s.array(s.int()) });
const Push = s.object({ v: s.int() });
const Secretive = s.object({ token: s.secret(s.string()), v: s.int() });
/** A typed payload holds a `Secret`, which only parsing makes. */
function sealed(v: number) {
  const p = Secretive.parse({ token: "t", v });
  if (!p.ok) throw new Error("secret payload did not parse");
  return p.value;
}
const opts = { seed: 1337, numRuns: 100 };

function make(logLimit?: number) {
  return inScope(() => {
    const bag = store(Bag, { items: [] }, logLimit === undefined ? {} : { logLimit });
    const push = transaction(bag, "bag.push", Push, (state, { v }) => ({ items: [...state.items, v] }));
    const secretPush = transaction(bag, "bag.secretPush", Secretive, (state, { v }) => ({
      items: [...state.items, v],
    }));
    return { bag, push, secretPush };
  });
}

type Step = { kind: "push"; v: number } | { kind: "secret"; v: number } | { kind: "undo" };
const stepArb: fc.Arbitrary<Step> = fc.oneof(
  { weight: 4, arbitrary: fc.integer({ min: -50, max: 50 }).map((v): Step => ({ kind: "push", v })) },
  { weight: 1, arbitrary: fc.integer({ min: -50, max: 50 }).map((v): Step => ({ kind: "secret", v })) },
  { weight: 2, arbitrary: fc.constant<Step>({ kind: "undo" }) },
);

function run(k: ReturnType<typeof make>, steps: readonly Step[]): void {
  for (const st of steps) {
    if (st.kind === "push") tx(k.push, { v: st.v });
    else if (st.kind === "secret") tx(k.secretPush, sealed(st.v));
    else k.bag.undo();
  }
}

describe("k.sync: head and restore", () => {
  it("`restore(snapshot())` keeps `head()`, also through a JSON round trip", () => {
    fc.assert(
      fc.property(fc.array(stepArb, { maxLength: 30 }), (steps) => {
        const src = make();
        run(src, steps);
        const direct = make();
        direct.bag.restore(src.bag.snapshot());
        expect(direct.bag.head()).toBe(src.bag.head());
        const wire = make();
        wire.bag.restore(JSON.parse(JSON.stringify(src.bag.snapshot())));
        expect(wire.bag.head()).toBe(src.bag.head());
        expect(wire.bag.snapshot().head).toBe(src.bag.head());
      }),
      opts,
    );
  });

  it("`snapshot()` holds `head`, equal to `head()`", () => {
    fc.assert(
      fc.property(fc.array(stepArb, { maxLength: 30 }), (steps) => {
        const k = make();
        run(k, steps);
        expect(k.bag.snapshot().head).toBe(k.bag.head());
      }),
      opts,
    );
  });

  it("a snapshot without `head` restores its latest entry's `id`, else 0", () => {
    fc.assert(
      fc.property(fc.array(stepArb, { maxLength: 30 }), (steps) => {
        const src = make();
        run(src, steps);
        const wire = JSON.parse(JSON.stringify(src.bag.snapshot()));
        delete wire.head;
        const dst = make();
        dst.bag.restore(wire);
        expect(dst.bag.head()).toBe(wire.log.at(-1)?.id ?? 0);
      }),
      opts,
    );
    const src = make();
    tx(src.push, { v: 1 });
    src.bag.undo();
    const wire = JSON.parse(JSON.stringify(src.bag.snapshot()));
    wire.head = undefined;
    const dst = make();
    dst.bag.restore(wire);
    expect(dst.bag.head()).toBe(0);
  });

  it("folding past `logLimit` leaves `head()` unchanged and `snapshot().head` equal to it", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 5 }), fc.integer({ min: 0, max: 20 }), (logLimit, commits) => {
        const k = make(logLimit);
        for (let i = 0; i < commits; i++) {
          expect(tx(k.push, { v: i }).ok).toBe(true);
          expect(k.bag.head()).toBe(i + 1);
          expect(k.bag.log().length).toBeLessThanOrEqual(logLimit);
        }
        expect(k.bag.head()).toBe(commits);
        expect(k.bag.snapshot().head).toBe(commits);
      }),
      opts,
    );
  });

  it("restoring a snapshot whose log exceeds `logLimit` leaves `head()` as the snapshot's", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 3 }), fc.integer({ min: 1, max: 12 }), (logLimit, commits) => {
        const src = make();
        for (let i = 0; i < commits; i++) tx(src.push, { v: i });
        const dst = make(logLimit);
        dst.bag.restore(JSON.parse(JSON.stringify(src.bag.snapshot())));
        expect(dst.bag.head()).toBe(commits);
        expect(dst.bag.snapshot().head).toBe(commits);
      }),
      opts,
    );
  });

  it("folding a secret into `initial` leaves `head()` unchanged and `snapshot().head` equal to it", () => {
    fc.assert(
      fc.property(fc.array(stepArb, { maxLength: 30 }), (steps) => {
        const k = make();
        run(k, steps);
        const before = k.bag.head();
        expect(tx(k.secretPush, sealed(1)).ok).toBe(true);
        expect(k.bag.head()).toBe(before + 1);
        const snap = k.bag.snapshot();
        expect(snap.head).toBe(before + 1);
        expect(k.bag.head()).toBe(before + 1);
        const dst = make();
        dst.bag.restore(JSON.parse(JSON.stringify(snap)));
        expect(dst.bag.head()).toBe(before + 1);
      }),
      opts,
    );
  });
});
