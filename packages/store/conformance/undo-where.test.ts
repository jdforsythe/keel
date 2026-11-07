import type { LogEntry } from "@keel/store";
import { tx } from "@keel/store";
// Spec: k.store `undoWhere(pred)` undoes exactly when the latest entry satisfies `pred` and otherwise changes nothing. Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { makeCart, opArb, opts } from "./fixtures";
import type { Op } from "./fixtures";

const stepArb = fc.record({ op: opArb, caller: fc.constantFrom("a", "b", "c") });

function run(k: ReturnType<typeof makeCart>, op: Op, caller: string) {
  const options = { meta: { caller } };
  switch (op.kind) {
    case "add":
      return tx(k.add, { item: op.item }, options);
    case "pop":
      return tx(k.pop, {}, options);
    case "clear":
      return tx(k.clear, {}, options);
  }
}

describe("k.store: undoWhere", () => {
  it("`undoWhere(pred)` undoes exactly when the latest entry satisfies `pred`: result equals `undo()` on a twin store", () => {
    fc.assert(
      fc.property(fc.array(stepArb, { maxLength: 15 }), fc.constantFrom("a", "b", "c"), (steps, who) => {
        const a = makeCart();
        const b = makeCart();
        for (const st of steps) {
          run(a, st.op, st.caller);
          run(b, st.op, st.caller);
        }
        const last = steps[steps.length - 1];
        const did = a.cart.undoWhere((e) => e.meta?.caller === who);
        expect(did).toBe(last !== undefined && last.caller === who);
        if (did) {
          expect(b.cart.undo()).toBe(true);
        }
        expect(a.cart.snapshot({ meta: true })).toEqual(b.cart.snapshot({ meta: true }));
        expect(a.cart.log()).toEqual(b.cart.log());
      }),
      opts,
    );
  });

  it("`undoWhere(pred)` otherwise changes nothing: state and log are unchanged when the latest entry does not match", () => {
    fc.assert(
      fc.property(fc.array(stepArb, { minLength: 1, maxLength: 15 }), (steps) => {
        const k = makeCart();
        for (const st of steps) run(k, st.op, st.caller);
        const before = JSON.stringify(k.cart.snapshot({ meta: true }));
        expect(k.cart.undoWhere(() => false)).toBe(false);
        expect(JSON.stringify(k.cart.snapshot({ meta: true }))).toBe(before);
      }),
      opts,
    );
  });

  it("`undoWhere(pred)` never undoes an older matching entry", () => {
    fc.assert(
      fc.property(fc.array(stepArb, { minLength: 2, maxLength: 15 }), (steps) => {
        const k = makeCart();
        for (const st of steps) run(k, st.op, st.caller);
        const lastId = k.cart.log()[k.cart.log().length - 1]?.id;
        const before = JSON.stringify(k.cart.snapshot({ meta: true }));
        const seen: LogEntry[] = [];
        const did = k.cart.undoWhere((e) => {
          seen.push(e);
          return e.id !== lastId;
        });
        expect(did).toBe(false);
        expect(seen.every((e) => e.id === lastId)).toBe(true);
        expect(JSON.stringify(k.cart.snapshot({ meta: true }))).toBe(before);
      }),
      opts,
    );
  });

  it("`undoWhere(pred)` on an empty log returns false without asking a non-existent entry", () => {
    const k = makeCart();
    let asked = 0;
    expect(
      k.cart.undoWhere(() => {
        asked++;
        return true;
      }),
    ).toBe(false);
    expect(asked).toBe(0);
  });

  it("`undo()` is unchanged: it drops the latest entry regardless of meta", () => {
    fc.assert(
      fc.property(fc.array(stepArb, { minLength: 1, maxLength: 10 }), (steps) => {
        const k = makeCart();
        for (const st of steps) run(k, st.op, st.caller);
        expect(k.cart.undo()).toBe(true);
        expect(k.cart.log().length).toBe(steps.length - 1);
      }),
      opts,
    );
  });
});
