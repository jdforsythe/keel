// coverage reads an explore result as data: unreached is the declared states no explored state holds, dead the
// non-final states a terminal state holds, both in declaration order. Seed 1337.
import { coverage } from "@keel/std-statecharts";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const NAMES = ["a", "b", "c", "d"] as const;
const name = fc.constantFrom(...NAMES);

describe("coverage", () => {
  test("unreached and dead follow the explored and terminal states", () => {
    fc.assert(
      fc.property(
        fc.record({ a: fc.boolean(), b: fc.boolean(), c: fc.boolean(), d: fc.boolean() }),
        fc.array(name, { maxLength: 6 }),
        fc.array(name, { maxLength: 4 }),
        (finals, held, stuck) => {
          const states = {
            a: { final: finals.a },
            b: { final: finals.b },
            c: { final: finals.c },
            d: { final: finals.d },
          };
          const wrap = (n: string) => ({ state: n, data: { n: 0 } });
          const r = coverage(
            { states },
            {
              states: [...held, ...stuck].map(wrap),
              terminal: [...stuck, 7].map((n) => (typeof n === "string" ? wrap(n) : n)),
            },
          );
          expect(r.unreached).toEqual(NAMES.filter((n) => !held.includes(n) && !stuck.includes(n)));
          expect(r.dead).toEqual(NAMES.filter((n) => stuck.includes(n) && !finals[n]));
        },
      ),
      { seed: 1337, numRuns: 200 },
    );
  });
});
