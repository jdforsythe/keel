// Seed 1337. Properties of the k.values grammar: its edge cases (`valueEdges`) get their verdicts, and a value the
// grammar accepts stays accepted inside `calc()` and refused once a hazard is appended, whatever the value.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { valueEdges } from "../src/internal/valueEdges.ts";
import { valueForms } from "../src/internal/valueForms.ts";

const SEED = 1337;
const verdict = (group: string, value: string): boolean =>
  valueForms({ color: { text: "#111111" }, [group]: { a: value } }).length === 0;

describe("valueForms", () => {
  it("accepts every accepted edge case and refuses every refused one", () => {
    const { accepted, refused } = valueEdges();
    for (const [g, v] of accepted) expect(verdict(g, v), `${g}: ${JSON.stringify(v)}`).toBe(true);
    for (const [g, v] of refused) expect(verdict(g, v), `${g}: ${JSON.stringify(v)}`).toBe(false);
  });

  it("a space length accepted alone is accepted inside calc() at up to four brackets, and refused at five", () => {
    const units = ["px", "rem", "vw", "cqi", "dvh", "%"];
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 999 }),
        fc.constantFrom(...units),
        fc.integer({ min: 1, max: 5 }),
        (n, u, depth) => {
          let v = `${n}${u}`;
          expect(verdict("space", v)).toBe(true);
          for (let i = 0; i < depth; i++) v = `calc(${v})`;
          expect(verdict("space", v)).toBe(depth <= 4);
        },
      ),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("any accepted edge case followed by a hazard is refused", () => {
    const { accepted } = valueEdges();
    fc.assert(
      fc.property(
        fc.constantFrom(...accepted),
        fc.constantFrom(";", "}", "\\", "\n", "\f", " !important", "/*", "url("),
        ([g, v], h) => {
          expect(verdict(g, `${v}${h}`)).toBe(false);
        },
      ),
      { seed: SEED, numRuns: 300 },
    );
  });
});
