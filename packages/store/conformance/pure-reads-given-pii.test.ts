// Spec: k.store, clause "`givenPii(entry)` gives the non-empty strings and numbers under a `.pii()` mark of a committed entry's payload as `tx` was given it (`piiValues`, k.schema), a marked open object's undeclared keys and all under them among them, which the logged payload no longer holds; empty for an unmarked payload schema or an entry this process did not commit."
// Spec: k.store, clause "It is held in memory only and never in a snapshot; a session recorder drops these values from later error text (std.sessions)."
// Spec: k.store, clause "`givenPii(store)` gives the same of the store's state as last given: `initial` at creation, the state a `restore` was given, or the state a commit or undo made."
// Seed 1337 (fast-check `seed: 1337`).
// Undo sequences: k.store says `givenPii(store)` after an undo gives "what it gave when the entry now latest was committed (with none left, the base's: `initial`, a `restore`'s values, or those of the last entry the log limit folded into it)". k.store names no redo, so none is asserted.
// Reading: the result is compared as a set (no order or multiplicity is stated); a number is `String(n)` as `piiValues` gives it. "An entry this process did not commit" is asserted for an entry of a store that only `restore`d a snapshot and for an entry built by hand. "Never in a snapshot": the undeclared keys and values, which the logged payload no longer holds, appear in no `snapshot()`; values the payload's schema declares are in the payload, so in the snapshot as the payload.
import { scope } from "@keel/reactive";
import { type Infer, piiValues, s } from "@keel/schema";
import { givenPii, isolate, store, transaction, tx } from "@keel/store";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const opts = { seed: 1337, numRuns: 60 };
const Doc = s.object({ n: s.int() });
const Marked = s.object({ n: s.int(), contact: s.object({ email: s.string() }).pii("contact"), note: s.string() });
const Unmarked = s.object({ n: s.int(), contact: s.object({ email: s.string() }), note: s.string() });

function isolated<T>(fn: () => T): T {
  const sc = scope(() => {});
  isolate(sc);
  return sc.run(fn);
}
function make() {
  return isolated(() => {
    const id = "pure.pii";
    const doc = store(Doc, { n: 0 }, { id });
    const marked = transaction(doc, `${id}.marked`, Marked, (st) => st);
    const unmarked = transaction(doc, `${id}.unmarked`, Unmarked, (st) => st);
    return { doc, marked, unmarked };
  });
}
const word = fc.stringMatching(/^[a-z]{16}$/);
const sorted = (xs: readonly string[]): string[] => [...xs].sort();
const last = <T>(xs: readonly T[]): T => {
  const x = xs[xs.length - 1];
  if (x === undefined) throw new Error("no entry");
  return x;
};

/** A payload whose marked open `contact` holds undeclared keys, strings, numbers and nested values, each marker distinct. */
const payloadArb = fc
  .tuple(word, word, word, word, word, fc.integer({ min: 100000, max: 999999 }), fc.integer({ min: -9, max: 9 }))
  .map(([email, k1, v1, k2, v2, num, n]) => ({
    markers: { email, k1, v1, k2, v2, num: String(num) },
    payload: {
      n,
      note: "kept",
      contact: { email, [`a${k1}`]: `b${v1}`, num, deep: { [`c${k2}`]: [`d${v2}`, "", 7] }, empty: "" },
    },
  }));

describe("k.store: givenPii", () => {
  it("gives the non-empty strings and numbers under a `.pii()` mark of a committed entry's payload as `tx` was given it, undeclared keys and all under them among them", () => {
    fc.assert(
      fc.property(payloadArb, ({ markers, payload }) => {
        const k = make();
        expect(tx(k.marked, payload).ok).toBe(true);
        const entry = last(k.doc.log());
        const got = givenPii(entry);
        expect(sorted(got)).toEqual(sorted(piiValues(Marked, payload)));
        for (const m of [
          `a${markers.k1}`,
          `b${markers.v1}`,
          `c${markers.k2}`,
          `d${markers.v2}`,
          markers.email,
          markers.num,
        ])
          expect(got).toContain(m);
        expect(got).toContain("7");
        expect(got).not.toContain("");
        // the logged payload no longer holds the undeclared ones
        const logged = JSON.stringify(entry.payload);
        for (const m of [`a${markers.k1}`, `b${markers.v1}`, `c${markers.k2}`, `d${markers.v2}`])
          expect(logged).not.toContain(m);
      }),
      opts,
    );
  });

  it("is empty for an unmarked payload schema", () => {
    fc.assert(
      fc.property(payloadArb, ({ payload }) => {
        const k = make();
        expect(tx(k.unmarked, payload).ok).toBe(true);
        expect(givenPii(last(k.doc.log()))).toEqual([]);
      }),
      opts,
    );
  });

  it("is empty for an entry this process did not commit: one a store restored, and one built by hand", () => {
    fc.assert(
      fc.property(payloadArb, ({ payload }) => {
        const a = make();
        const b = make();
        tx(a.marked, payload);
        expect(givenPii(last(a.doc.log())).length).toBeGreaterThan(0);
        b.doc.restore(a.doc.snapshot());
        expect(b.doc.log().length).toBe(1);
        expect(givenPii(last(b.doc.log()))).toEqual([]);
        const byHand = { ...last(a.doc.log()) };
        expect(givenPii(byHand)).toEqual([]);
      }),
      opts,
    );
  });

  it("is held in memory only and never in a snapshot: no snapshot of the store holds an undeclared key or value, and a snapshot's JSON round trip restores to an entry with none", () => {
    fc.assert(
      fc.property(payloadArb, ({ markers, payload }) => {
        const a = make();
        tx(a.marked, payload);
        const undeclared = [`a${markers.k1}`, `b${markers.v1}`, `c${markers.k2}`, `d${markers.v2}`];
        for (const snap of [a.doc.snapshot(), a.doc.snapshot({ meta: true })]) {
          const text = JSON.stringify(snap);
          for (const m of undeclared) expect(text).not.toContain(m);
        }
        const b = make();
        b.doc.restore(JSON.parse(JSON.stringify(a.doc.snapshot())));
        expect(givenPii(last(b.doc.log()))).toEqual([]);
        expect(givenPii(last(a.doc.log())).length).toBeGreaterThan(0);
      }),
      opts,
    );
  });

  describe("givenPii(store): the store's state as last given", () => {
    // A state whose `p` is a marked open object: its undeclared keys, and every non-empty string and number under it, are the values.
    const St = s.object({ p: s.object({}).pii("contact"), n: s.int() });
    const none = s.object({});
    const stateArb = fc.tuple(word, word, fc.integer({ min: 100000, max: 999999 })).map(([k, v, num]) => ({
      markers: [`a${k}`, `b${v}`, String(num), `c${k}`, `d${v}`],
      state: { n: 1, p: { [`a${k}`]: `b${v}`, num, deep: { [`c${k}`]: [`d${v}`, ""] }, empty: "" } },
    }));
    const empty = { n: 0, p: {} };
    const build = (initial: Infer<typeof St>, logLimit?: number) =>
      isolated(() => {
        const st = store(St, initial, { id: "pure.state.pii", ...(logLimit === undefined ? {} : { logLimit }) });
        let next: Infer<typeof St> = empty;
        const set = transaction(st, "pure.state.set", none, () => next);
        return { st, commit: (n: Infer<typeof St>) => ((next = n), tx(set, {})) };
      });

    it("is the marked values of `initial` at creation, undeclared keys and all under them among them, and empty for an unmarked state", () => {
      fc.assert(
        fc.property(stateArb, ({ markers, state }) => {
          const k = build(state);
          const got = givenPii(k.st);
          expect(sorted(got)).toEqual(sorted(piiValues(St, state)));
          for (const m of markers) expect(got).toContain(m);
          expect(got).not.toContain("");
          expect(givenPii(build(empty).st)).toEqual([]);
        }),
        opts,
      );
    });

    it("is the marked values of the state a `restore` was given", () => {
      fc.assert(
        fc.property(stateArb, ({ markers, state }) => {
          const k = build(empty);
          expect(givenPii(k.st)).toEqual([]);
          k.st.restore({ ...k.st.snapshot(), initial: state, log: [], keys: [] });
          const got = givenPii(k.st);
          expect(sorted(got)).toEqual(sorted(piiValues(St, state)));
          for (const m of markers) expect(got).toContain(m);
        }),
        opts,
      );
    });

    it("is the marked values of the state a commit made, and of the state an undo made", () => {
      fc.assert(
        fc.property(stateArb, ({ markers, state }) => {
          const k = build(empty);
          expect(k.commit(state).ok).toBe(true);
          const afterCommit = givenPii(k.st);
          expect(sorted(afterCommit)).toEqual(sorted(piiValues(St, state)));
          for (const m of markers) expect(afterCommit).toContain(m);
          expect(k.commit(empty).ok).toBe(true);
          expect(givenPii(k.st)).toEqual([]);
          expect(k.st.undo()).toBe(true);
          const afterUndo = givenPii(k.st);
          expect(sorted(afterUndo)).toEqual(sorted(piiValues(St, state)));
          for (const m of markers) expect(afterUndo).toContain(m);
        }),
        opts,
      );
    });

    const sameAs = (got: readonly string[], state: Infer<typeof St>): void => {
      expect(sorted(got)).toEqual(sorted(piiValues(St, state)));
    };
    const four = fc.tuple(stateArb, stateArb, stateArb, stateArb);

    it("after an undo is what it gave when the entry now latest was committed, and with none left the base's `initial` values", () => {
      fc.assert(
        fc.property(stateArb, stateArb, stateArb, (i, a, b) => {
          const k = build(i.state);
          expect(k.commit(a.state).ok).toBe(true);
          expect(k.commit(b.state).ok).toBe(true);
          sameAs(givenPii(k.st), b.state);
          expect(k.st.undo()).toBe(true);
          sameAs(givenPii(k.st), a.state);
          expect(k.st.undo()).toBe(true);
          sameAs(givenPii(k.st), i.state);
          expect(k.st.undo()).toBe(false);
          sameAs(givenPii(k.st), i.state);
        }),
        opts,
      );
    });

    it("after an undo with none left gives the values of a `restore` that made the base", () => {
      fc.assert(
        fc.property(stateArb, stateArb, stateArb, (i, r, a) => {
          const k = build(i.state);
          k.st.restore({ ...k.st.snapshot(), initial: r.state, state: r.state, log: [], keys: [] });
          expect(k.commit(a.state).ok).toBe(true);
          sameAs(givenPii(k.st), a.state);
          expect(k.st.undo()).toBe(true);
          sameAs(givenPii(k.st), r.state);
        }),
        opts,
      );
    });

    it("after an undo with none left gives the values of the last entry the log limit folded into the base", () => {
      fc.assert(
        fc.property(four, ([a, b, c, d]) => {
          const k = build(empty, 2);
          for (const x of [a, b, c, d]) expect(k.commit(x.state).ok).toBe(true);
          expect(k.st.log().length).toBe(2);
          sameAs(givenPii(k.st), d.state);
          expect(k.st.undo()).toBe(true);
          sameAs(givenPii(k.st), c.state);
          expect(k.st.undo()).toBe(true);
          sameAs(givenPii(k.st), b.state);
          expect(k.st.undo()).toBe(false);
          sameAs(givenPii(k.st), b.state);
        }),
        opts,
      );
    });
  });
});
