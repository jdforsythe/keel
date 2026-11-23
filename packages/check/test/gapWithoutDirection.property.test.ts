// k.ui E1809: the breakpoint order, states, looks and base roles, part styles and the fix's text.
import * as fc from "fast-check";
import { expect, it } from "vitest";
import { check } from "../src/index.ts";
import { missingAt } from "../src/internal/missingAt.ts";

const ORDER = ["sm", "md", "lg"];
const TOKENS = { space: { 2: "8px" }, breakpoint: { sm: "480px", md: "768px", lg: "1024px" } };
const e1809 = (jsx: string, tokens: object = TOKENS) =>
  check(
    [
      {
        path: "src/C.tsx",
        source: `import { Box, Button, Text } from '@keel/ui'\nexport default function C(props) { return ${jsx} }\n`,
      },
    ],
    { types: false, artifacts: { tokens } },
  ).diagnostics.filter((d) => d.code === "E1809");

const keys = fc.subarray(["base", ...ORDER], { minLength: 1 });
const rank = (k: string): number => (k === "base" ? 0 : ORDER.indexOf(k) + 1);

it("gap is missing a direction exactly when no direction key ranks at or below gap's smallest (property)", () => {
  fc.assert(
    fc.property(keys, fc.subarray(["base", ...ORDER]), (gap, dir) => {
      const smallest = Math.min(...gap.map(rank));
      const covered = dir.some((k) => rank(k) <= smallest);
      const at = missingAt(gap, [dir], ORDER);
      expect(at === undefined).toBe(covered);
      if (at !== undefined) expect(rank(at)).toBe(smallest);
      expect(missingAt(gap, [dir, null], ORDER)).toBeUndefined();
    }),
    { seed: 1337, numRuns: 200 },
  );
});

it("a breakpoint outside the tokens ranks last, so two unknown keys never disagree", () => {
  expect(missingAt(["xl"], [["xxl"]], ORDER)).toBeUndefined();
  expect(missingAt(["base"], [["xl"]], ORDER)).toBe("base");
});

it("responsive gap and direction follow the breakpoint token order", () => {
  expect(e1809(`<Box gap={{ md: '2' }} direction={{ sm: 'row' }} />`)).toEqual([]);
  expect(e1809(`<Box gap={{ sm: '2' }} direction={{ md: 'row' }} />`)).toHaveLength(1);
  expect(e1809(`<Box gap={{ lg: '2', md: '2' }} direction={{ md: 'row' }} />`)).toEqual([]);
});

it("the fix adds a column key at gap's smallest breakpoint", () => {
  const [inside] = e1809(`<Box gap={{ sm: '2' }} direction={{ md: 'row' }} />`);
  expect(inside?.fix).toContain("direction={{ sm: 'column', md: 'row' }}");
  const [alone] = e1809(`<Box gap={{ md: '2' }} />`);
  expect(alone?.fix).toContain(`direction={{ md: 'column' }} gap={{ md: '2' }}`);
});

it("a state's gap reads the base-state direction, and its own", () => {
  expect(e1809(`<Box direction="row" states={{ hover: { gap: '2' } }} />`)).toEqual([]);
  const [d] = e1809(`<Box states={{ hover: { gap: '2' } }} />`);
  expect(d?.fix).toContain("hover: { direction: 'column', gap: '2' }");
  expect(e1809(`<Box states={{ hover: { gap: '2', direction: 'row' } }} />`)).toEqual([]);
});

it("part styles, Part, a computed look, a spread and a base role's direction", () => {
  expect(e1809(`<Box styles={{ field: { gap: '2' } }} />`)).toHaveLength(1);
  expect(e1809(`<Box styles={{ field: { gap: '2', direction: 'row' } }} />`)).toEqual([]);
  expect(e1809(`<Part gap="2" />`)).toHaveLength(1);
  expect(e1809(`<Box look={props.l} gap="2" />`)).toEqual([]);
  expect(e1809(`<Box {...props} gap="2" />`)).toEqual([]);
  expect(e1809(`<Button gap="2">a</Button>`, { ...TOKENS, base: { button: { direction: "row" } } })).toEqual([]);
  expect(e1809(`<Button gap="2">a</Button>`)).toHaveLength(1);
});

it("a look's states and base sets are read; base.focus is not a set", () => {
  const tokens = {
    ...TOKENS,
    look: { a: { direction: "row", states: { hover: { gap: "2" } } } },
    base: { focus: "fg" },
  };
  expect(e1809("<Box />", tokens)).toEqual([]);
  const bad = e1809("<Box />", { ...TOKENS, look: { a: { states: { hover: { gap: "2" } } } } });
  expect(bad.map((d) => d.message)).toEqual([
    "gap without direction in look.a.states.hover: name the axis its children are spaced along",
  ]);
});
