// Spec: k.schema, Conformance "For every generated schema with marked nodes, `parse`, `encode`, `decodeStrings` and `gen` give what the unmarked schema gives."
// Seed: 1337.
// Skipped until `.pii(class)` exists.
import { type StringInput, s } from "@keel/schema";
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RUNS, SEED, buildObject, markedRoot, strippedRoot } from "./privacy-fixtures";

/** The wire form of a value's primitive top-level fields, as a form or query string would send them. */
const wire = (value: unknown): StringInput => {
  const out: Record<string, string> = {};
  if (typeof value === "object" && value !== null)
    for (const [k, v] of Object.entries(value))
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[k] = String(v);
  return out;
};

describe("k.privacy marked schemas keep every derivation", () => {
  it("for every generated schema with marked nodes, parse, encode, decodeStrings and gen give what the unmarked schema gives", () => {
    fc.assert(
      fc.property(markedRoot, fc.anything(), (spec, junk) => {
        const marked = buildObject(spec);
        const plain = buildObject(strippedRoot(spec));
        const samples = fc.sample(gen(marked), { seed: SEED, numRuns: 10 });
        // gen: the same seeded samples.
        expect(samples).toEqual(fc.sample(gen(plain), { seed: SEED, numRuns: 10 }));
        for (const v of samples) {
          expect(marked.parse(v)).toEqual(plain.parse(v));
          expect(marked.encode(v)).toEqual(plain.encode(v));
          expect(marked.parse(marked.encode(v))).toEqual(plain.parse(plain.encode(v)));
          expect(marked.decodeStrings(wire(v))).toEqual(plain.decodeStrings(wire(v)));
        }
        // invalid input gives the same issues.
        expect(marked.parse(junk)).toEqual(plain.parse(junk));
        expect(marked.parse(undefined)).toEqual(plain.parse(undefined));
        expect(marked.decodeStrings({})).toEqual(plain.decodeStrings({}));
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("a marked string keeps the string type: parse and encode agree with s.string()", () => {
    const marked = s.string().pii("contact");
    fc.assert(
      fc.property(fc.string(), (v) => {
        expect(marked.parse(v)).toEqual(s.string().parse(v));
        expect(marked.encode(v)).toEqual(s.string().encode(v));
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
});
