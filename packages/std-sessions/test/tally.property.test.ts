// std.monitor: merging tallies is associative and commutative, sums the counts and spans the merge times.
// Seed 1337
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { Tally } from "../src/monitor/Tally.schema.ts";
import { mergeTally } from "../src/monitor/internal/mergeTally.ts";

const nameArb = fc.constantFrom("api.addTodo", "api.toggleTodo", "api.editTodo", "todos.editor.save");
const tallyArb: fc.Arbitrary<Tally> = fc
  .tuple(fc.nat({ max: 1_000_000 }), fc.nat({ max: 1_000_000 }), fc.dictionary(nameArb, fc.nat({ max: 500 })))
  .map(([a, b, tx]) => ({ v: 1, from: Math.min(a, b), to: Math.max(a, b), tx }));

describe("mergeTally", () => {
  test("is associative", () => {
    fc.assert(
      fc.property(tallyArb, tallyArb, tallyArb, (a, b, c) => {
        expect(mergeTally(mergeTally(a, b), c)).toStrictEqual(mergeTally(a, mergeTally(b, c)));
      }),
      { seed: 1337, numRuns: 100 },
    );
  });

  test("is commutative, sums each count and spans from and to", () => {
    fc.assert(
      fc.property(tallyArb, tallyArb, (a, b) => {
        const m = mergeTally(a, b);
        expect(m).toStrictEqual(mergeTally(b, a));
        expect(Tally.parse(m).ok).toBe(true);
        expect(Object.keys(m.tx)).toEqual(Object.keys(m.tx).sort());
        for (const name of Object.keys(m.tx)) expect(m.tx[name]).toBe((a.tx[name] ?? 0) + (b.tx[name] ?? 0));
        expect([m.from, m.to]).toEqual([Math.min(a.from, b.from), Math.max(a.to, b.to)]);
      }),
      { seed: 1337, numRuns: 100 },
    );
  });
});
