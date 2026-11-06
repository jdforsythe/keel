// Spec: k.ui Conformance 1. Property seed: 1337.
import { compileStyles } from "@keel/ui/css";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, countRules, tokens } from "./fixtures.ts";

const propSets = fc.record(
  {
    p: fc.constantFrom("0", "1", "2", "3"),
    m: fc.constantFrom("0", "1", "2", "3"),
    gap: fc.constantFrom("0", "1", "2", "3"),
    bg: fc.constantFrom("fg", "bg", "accent"),
    fg: fc.constantFrom("fg", "bg", "accent"),
    radius: fc.constantFrom("1"),
    fontSize: fc.constantFrom("sm", "md", "lg"),
  },
  { requiredKeys: [] },
);

describe("k.ui: Two elements with identical style props get identical class lists, and the CSS file contains each atomic rule once", () => {
  it("Two elements with identical style props get identical class lists, and the CSS file contains each atomic rule once", () => {
    fc.assert(
      fc.property(propSets, propSets, (a, b) => {
        const { classes, css } = compileStyles({ tokens, usages: [{ props: a }, { props: { ...a } }, { props: b }] });
        expect(classes[0]).toEqual(classes[1]);
        for (const c of new Set(classes.flat())) expect(countRules(css, c)).toBe(1);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
});
