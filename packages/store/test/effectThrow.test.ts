// Seed 1337. An effect that throws on a commit: the commit stands (k.reactive: without `onError` the throw rethrows
// from the commit that ran it); with `onError` the error goes there and `tx` returns `ok`.
import { effect, scope } from "@keel/reactive";
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { store, transaction, tx } from "../src/index.ts";

const State = s.object({ n: s.int() });
const opts = { seed: 1337, numRuns: 50 };

describe("an effect that throws on a tx commit", () => {
  it("without onError rethrows from tx after state, log and head moved", () => {
    scope(() => {
      const c = store(State, { n: 0 }, { id: "et.bare" });
      const add = transaction(c, "et.bare.add", s.object({ by: s.int() }), (st, p) => ({ n: st.n + p.by }));
      effect(() => {
        if (c.get("n") > 0) throw new Error("boom");
      });
      expect(() => tx(add, { by: 1 })).toThrow("boom");
      expect({ n: c.get("n"), log: c.log().length, head: c.head() }).toEqual({ n: 1, log: 1, head: 1 });
    }).dispose();
  });

  it("with onError hands the error there and tx returns ok with the committed state", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 1, max: 9 }), { minLength: 1, maxLength: 6 }), (bys) => {
        const seen: unknown[] = [];
        scope(
          () => {
            const c = store(State, { n: 0 }, { id: "et.handled" });
            const add = transaction(c, "et.handled.add", s.object({ by: s.int() }), (st, p) => ({ n: st.n + p.by }));
            effect(() => {
              if (c.get("n") > 0) throw new Error("boom");
            });
            let sum = 0;
            for (const by of bys) {
              sum += by;
              const r = tx(add, { by });
              expect(r.ok && r.value.n).toBe(sum);
            }
            expect(c.head()).toBe(bys.length);
          },
          { onError: (e) => seen.push(e) },
        ).dispose();
        // The throwing effect does not run again.
        expect(seen.length).toBe(1);
      }),
      opts,
    );
  });
});
