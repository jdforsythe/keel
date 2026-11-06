// Spec: k.ui Conformance 2. Property seed: 1337 (property over space tokens).
// Assumed: responsive `p={{ base, md }}` compiles to a base usage plus a usage with breakpoint "md".
import { compileStyles } from "@keel/ui/css";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, countRules, mediaBlocks, tokens, withoutMedia } from "./fixtures.ts";

describe("k.ui: p={{ base: '2', md: '3' }} yields the 2 rule unconditioned and the 3 rule inside @media (min-width: 768px)", () => {
  it("p={{ base: '2', md: '3' }} yields the 2 rule unconditioned and the 3 rule inside @media (min-width: 768px)", () => {
    const { classes, css } = compileStyles({
      tokens,
      usages: [{ props: { p: "2" } }, { props: { p: "3" }, breakpoint: "md" }],
    });
    const base = classes[0] ?? [];
    const md = classes[1] ?? [];
    expect(base).toHaveLength(1);
    expect(md).toHaveLength(1);
    const blocks = mediaBlocks(css, "(min-width:768px)");
    expect(blocks.length).toBeGreaterThan(0);
    const inMedia = blocks.join("");
    const outside = withoutMedia(css);
    for (const c of base) {
      expect(countRules(outside, c)).toBe(1);
      expect(countRules(inMedia, c)).toBe(0);
    }
    for (const c of md) {
      expect(countRules(inMedia, c)).toBe(1);
      expect(countRules(outside, c)).toBe(0);
    }
  });

  it("holds for every pair of distinct space tokens", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("0", "1", "2", "3"),
        fc.constantFrom("0", "1", "2", "3"),
        (a, b) => {
          fc.pre(a !== b);
          const { classes, css } = compileStyles({
            tokens,
            usages: [{ props: { p: a } }, { props: { p: b }, breakpoint: "md" }],
          });
          const inMedia = mediaBlocks(css, "(min-width:768px)").join("");
          const outside = withoutMedia(css);
          for (const c of classes[0] ?? []) expect(countRules(outside, c)).toBe(1);
          for (const c of classes[1] ?? []) expect(countRules(inMedia, c)).toBe(1);
        },
      ),
      { seed: SEED, numRuns: 50 },
    );
  });
});
