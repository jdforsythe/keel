// Spec: k.aria, Part styles "There and on `Part`, `states` also takes `selected` (`[aria-selected="true"]`), `checked` (`[aria-checked="true"]`, `:checked`), `expanded` (`[aria-expanded="true"]`) and `highlighted` (`[data-k-highlighted]`)."
// Seed: 1337. The CSS half of the k.aria Conformance clause on part styles quoted in packages/compiler/conformance/part-styles.test.ts.
// Assumed: a usage `{ props, state }` takes the states `selected`, `checked`, `expanded` and `highlighted` as it takes `hover`.
import { compileStyles } from "@keel/ui/css";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, countRules, cssEscape, tokens } from "./fixtures.ts";

const SELECTORS = {
  selected: ['[aria-selected="true"]'],
  checked: ['[aria-checked="true"]', ":checked"],
  expanded: ['[aria-expanded="true"]'],
  highlighted: ["[data-k-highlighted]"],
} as const;
type PartState = keyof typeof SELECTORS;
const states: PartState[] = ["selected", "checked", "expanded", "highlighted"];
const occurrences = (css: string, needle: string): number => css.split(needle).length - 1;

describe("k.aria: part states in the CSS file", () => {
  test.skip("`p: '2'` puts one rule and `bg: 'accent'` under `highlighted` puts one rule under `[data-k-highlighted]`", () => {
    const { classes, css } = compileStyles({
      tokens,
      usages: [{ props: { p: "2" } }, { props: { bg: "accent" }, state: "highlighted" }],
    });
    const plain = classes[0] ?? [];
    const under = classes[1] ?? [];
    expect(plain.length).toBeGreaterThan(0);
    expect(under.length).toBeGreaterThan(0);
    for (const c of plain) {
      expect(countRules(css, c)).toBe(1);
      expect(css).not.toContain(`.${cssEscape(c)}[data-k-highlighted]`);
    }
    for (const c of under) {
      expect(countRules(css, c)).toBe(1);
      expect(occurrences(css, `.${cssEscape(c)}[data-k-highlighted]`)).toBe(1);
    }
  });

  test.skip("each part state writes its selector, once per class however often it is used", () => {
    fc.assert(
      fc.property(fc.constantFrom(...states), fc.integer({ min: 1, max: 3 }), (state, times) => {
        const usage = { props: { bg: "accent" }, state } as const;
        const { classes, css } = compileStyles({ tokens, usages: Array.from({ length: times }, () => usage) });
        const cls = classes[0] ?? [];
        expect(cls.length).toBeGreaterThan(0);
        for (const c of cls) {
          for (const sel of SELECTORS[state]) expect(css).toContain(`.${cssEscape(c)}${sel}`);
        }
      }),
      { seed: SEED, numRuns: 24 },
    );
  });
});
