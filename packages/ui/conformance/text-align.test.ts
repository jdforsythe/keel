// Spec: k.ui, clause "`textAlign=\"end\"` on a `Part role=\"cell\"` compiles to one rule declaring `text-align:end` and no `display`; `textAlign={{ base: 'start', md: 'end' }}` puts the `end` rule inside the `md` media block; `textAlign=\"right\"` is E1801."
// Seed: 1337 (properties over the logical and the physical values).
// Not built yet (rfc:0203): the cases fail until `textAlign` is a style prop; they are plain `test`, not skipped.
// The usage is the compiled form of the prop on any element: `Part role="cell"` adds no rule of its own, so one usage stands for it.
import * as fc from "fast-check";
import { describe, expect, test } from "vitest";
import { codeOf, compileWith } from "./base-support.ts";
import { SEED, countRules, mediaBlocks, norm, withoutMedia } from "./fixtures.ts";

const LOGICAL = ["start", "center", "end"] as const;
const PHYSICAL = ["left", "right", "justify", "match-parent"] as const;

describe("k.ui: textAlign", () => {
  test('`textAlign="end"` on a `Part role="cell"` compiles to one rule declaring `text-align:end` and no `display`', () => {
    const { classes, css } = compileWith({}, [{ props: { textAlign: "end" } }]);
    const cls = classes[0] ?? [];
    expect(cls).toHaveLength(1);
    const n = norm(css);
    for (const c of cls) {
      expect(countRules(n, c)).toBe(1);
      const at = n.indexOf(`.${c}{`);
      const body = n.slice(at, n.indexOf("}", at));
      expect(body).toContain("text-align:end");
      expect(body).not.toContain("display");
    }
  });

  test("every logical `textAlign` value compiles to one rule declaring that `text-align` and no `display` (property)", () => {
    fc.assert(
      fc.property(fc.constantFrom(...LOGICAL), (v) => {
        const { classes, css } = compileWith({}, [{ props: { textAlign: v } }]);
        const cls = classes[0] ?? [];
        expect(cls).toHaveLength(1);
        const n = norm(css);
        for (const c of cls) {
          const at = n.indexOf(`.${c}{`);
          expect(at).toBeGreaterThanOrEqual(0);
          const body = n.slice(at, n.indexOf("}", at));
          expect(body).toContain(`text-align:${v}`);
          expect(body).not.toContain("display");
        }
      }),
      { seed: SEED, numRuns: 9 },
    );
  });

  test("`textAlign={{ base: 'start', md: 'end' }}` puts the `end` rule inside the `md` media block", () => {
    const { classes, css } = compileWith({}, [
      { props: { textAlign: "start" } },
      { props: { textAlign: "end" }, breakpoint: "md" },
    ]);
    const base = classes[0] ?? [];
    const md = classes[1] ?? [];
    expect(base).toHaveLength(1);
    expect(md).toHaveLength(1);
    const inMedia = mediaBlocks(css, "(min-width:768px)").join("");
    const outside = withoutMedia(css);
    for (const c of md) {
      expect(countRules(inMedia, c)).toBe(1);
      expect(countRules(outside, c)).toBe(0);
    }
    expect(inMedia).toContain("text-align:end");
    for (const c of base) {
      expect(countRules(outside, c)).toBe(1);
      expect(countRules(inMedia, c)).toBe(0);
    }
  });

  test('`textAlign="right"` is E1801', () => {
    expect(codeOf(() => compileWith({}, [{ props: { textAlign: "right" } }]))).toBe("E1801");
  });

  test("every physical or unknown `textAlign` value is E1801, every logical one is not (property)", () => {
    fc.assert(
      fc.property(fc.oneof(fc.constantFrom(...PHYSICAL), fc.stringMatching(/^[a-z]{3,8}$/)), (v) => {
        fc.pre(!LOGICAL.some((l) => l === v));
        expect(codeOf(() => compileWith({}, [{ props: { textAlign: v } }]))).toBe("E1801");
      }),
      { seed: SEED, numRuns: 40 },
    );
    for (const v of LOGICAL) expect(codeOf(() => compileWith({}, [{ props: { textAlign: v } }]))).toBe(null);
  });
});
