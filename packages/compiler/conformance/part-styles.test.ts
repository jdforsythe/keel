// Spec: k.aria, Conformance "`styles={{ option: { p: '2', states: { highlighted: { bg: 'accent' } } } }}` on a stdlib component puts the `2` rule and an `accent` rule under `[data-k-highlighted]` into the CSS file, once each."
// Seed: 1337.
// This file is the collection half: the usages `compile` writes to `styles.json`. The compiler may not import `@keel/ui`, so the CSS half
// (`compileStyles` of those usages, rules once each under `[data-k-highlighted]`) is packages/ui/conformance/aria-states-css.test.ts.
// A highlighted usage is assumed to be `{ props, state: 'highlighted' }`, the shape `StyleUsage` gives the other states.
import { compile } from "@keel/compiler";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const SEED = 1337;
const listbox = (styles: string, name = "C"): { path: string; source: string } => ({
  path: `${name}.tsx`,
  source: `import { Listbox } from '@keel/std-headless'
export default function ${name}() { return <Listbox id="l" label="Fruit" mode="single" options={() => []} selected={() => []} onChange={() => undefined} styles=${styles} /> }
`,
});
const HIGHLIGHT = "{{ option: { p: '2', states: { highlighted: { bg: 'accent' } } } }}";

type Usage = { props: Readonly<Record<string, string>>; state?: string };
const styled = (files: { path: string; source: string }[]): Usage[] => {
  const r = compile(files);
  expect(r.diagnostics).toEqual([]);
  return r.artifacts["styles.json"].usages;
};
const isHighlighted = (u: { state?: string }): boolean => u.state === "highlighted";

describe("k.aria: part styles", () => {
  test("`styles={{ option: { p: '2', states: { highlighted: { bg: 'accent' } } } }}` on a stdlib component collects the `2` usage and the `accent` usage under `highlighted`, once each", () => {
    const usages = styled([listbox(HIGHLIGHT)]);
    expect(usages.filter((u) => u.props.p === "2" && !isHighlighted(u))).toHaveLength(1);
    expect(usages.filter((u) => u.props.bg === "accent" && isHighlighted(u))).toHaveLength(1);
  });

  test("the same part styles in any number of files give the same usages, once each", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 4 }), (n) => {
        const files = Array.from({ length: n }, (_, i) => listbox(HIGHLIGHT, `C${i}`));
        expect(styled(files)).toEqual(styled([listbox(HIGHLIGHT)]));
      }),
      { seed: SEED, numRuns: 8 },
    );
  });

  test("`selected`, `checked` and `expanded` states are collected like `highlighted`", () => {
    for (const state of ["selected", "checked", "expanded"]) {
      const usages = styled([listbox(`{{ option: { states: { ${state}: { bg: 'accent' } } } }}`)]);
      expect(usages.filter((u) => u.props.bg === "accent" && u.state === state)).toHaveLength(1);
    }
  });
});
