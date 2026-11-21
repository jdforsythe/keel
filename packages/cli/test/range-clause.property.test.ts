// Properties of range clauses (k.ledger Ledger): `rangeCodes` reads every code of an `each` range and nothing from
// other clauses; `headerCodes` reads the codes a header names outside the quote, a header range giving its ends.
// Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { headerCodes } from "../src/internal/headerCodes.ts";
import { rangeCodes } from "../src/internal/rangeCodes.ts";

const SEED = 1337;
const letter = fc.constantFrom("E", "W", "I");
const lo = fc.integer({ min: 1000, max: 9000 });
const len = fc.integer({ min: 1, max: 8 });
const join = fc.constantFrom("-", " to ");

describe("range clause properties", () => {
  it("an `each` range gives every code from its first to its last, in order", () => {
    fc.assert(
      fc.property(letter, lo, len, join, (l, a, n, j) => {
        const codes = rangeCodes(`${l}${a}${j}${l}${a + n} each fire on a fixture.`);
        expect(codes).toEqual(Array.from({ length: n + 1 }, (_, i) => `${l}${a + i}`));
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("a range without `each`, or with its ends reversed or of two letters, is no range clause", () => {
    fc.assert(
      fc.property(letter, lo, len, (l, a, n) => {
        expect(rangeCodes(`No ${l}${a}-${l}${a + n}.`)).toBeUndefined();
        expect(rangeCodes(`${l}${a + n}-${l}${a} each fire.`)).toBeUndefined();
        expect(rangeCodes(`${l}${a}-${l === "E" ? "W" : "E"}${a + n} each fire.`)).toBeUndefined();
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("a header names the codes outside the quote only, and a header range its two ends", () => {
    fc.assert(
      fc.property(lo, len, (a, n) => {
        const clause = `E${a}-E${a + n} each fire.`;
        const quoted = [`// Spec: k.fx, clause "${clause}"`];
        expect([...headerCodes(quoted, clause)]).toEqual([]);
        expect([...headerCodes([`${quoted[0] ?? ""} (E${a}-E${a + n})`], clause)].sort()).toEqual(
          n === 0 ? [`E${a}`] : [`E${a}`, `E${a + n}`],
        );
        expect([...headerCodes([...quoted, `// Spec: k.fx rule e${a + n}`], clause)]).toEqual([`E${a + n}`]);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("a code inside a longer word is not named", () => {
    expect([...headerCodes(["// XE20011 E2001x E2002"], "x")]).toEqual(["E2002"]);
  });
});
