// k.store `givenPii`: a committed entry of a `.pii()`-marked payload schema carries, in memory, the marked values of the
// payload as given, an open object's undeclared keys and values among them, which the copied payload drops. Seed 1337.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { givenPii, store, transaction, tx } from "../src/index.ts";

test("a marked open payload's undeclared keys and values are in givenPii, not in the logged payload", () => {
  fc.assert(
    fc.property(fc.stringMatching(/^[a-z]{8}$/), fc.stringMatching(/^[a-z]{8}$/), fc.integer({ min: 1 }), (k, v, n) => {
      scope(() => {
        const st = store(s.object({ c: s.int() }), { c: 0 }, { id: "given.pii" });
        const marked = transaction(st, "given.marked", s.object({ p: s.object({}).pii("contact") }), (x) => x);
        const plain = transaction(st, "given.plain", s.object({ p: s.object({}) }), (x) => x);
        expect(tx(marked, { p: { [`k${k}`]: `v${v}`, n } }).ok).toBe(true);
        expect(tx(plain, { p: { [`k${k}`]: `v${v}` } }).ok).toBe(true);
        const [a, b] = st.log();
        expect(a?.payload).toEqual({ p: {} });
        expect(a === undefined ? [] : givenPii(a)).toEqual([`k${k}`, `v${v}`, "n", String(n)]);
        expect(b === undefined ? ["none"] : givenPii(b)).toEqual([]);
      }).dispose();
    }),
    { seed: 1337, numRuns: 30 },
  );
});

test("givenPii(store) gives the marked values of the state as last given: initial, a restore, a commit", () => {
  fc.assert(
    fc.property(fc.stringMatching(/^[a-z]{8}$/), fc.stringMatching(/^[a-z]{8}$/), (k, v) => {
      scope(() => {
        const S = s.object({ p: s.object({}).pii("contact") });
        const st = store(S, { p: { [`i${k}`]: `i${v}` } }, { id: "given.state" });
        expect(st.snapshot().state).toEqual({ p: {} });
        expect(givenPii(st)).toEqual([`i${k}`, `i${v}`]);
        expect(st.restore({ state: { p: { [`r${k}`]: `r${v}` } }, log: [], initial: { p: {} } }).ok).toBe(true);
        expect(givenPii(st)).toEqual([`r${k}`, `r${v}`]);
        const add = transaction(st, "given.add", s.object({}), (x) => ({ p: { ...x.p, [`t${k}`]: `t${v}` } }));
        expect(tx(add, {}).ok).toBe(true);
        expect(givenPii(st)).toEqual([`t${k}`, `t${v}`]);
        const plain = store(s.object({ p: s.object({}) }), { p: { [k]: v } }, { id: "given.plainState" });
        expect(givenPii(plain)).toEqual([]);
      }).dispose();
    }),
    { seed: 1337, numRuns: 30 },
  );
});
