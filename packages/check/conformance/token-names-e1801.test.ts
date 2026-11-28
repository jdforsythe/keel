// Spec: k.a11y-static, clause "With `brandTokens`, `keel check` reports one E1801 `fg=\"nope\" is not a color token` at `\"nope\"` for `<Text fg=\"nope\">x</Text>`, one `breakpoint \"xl\" is not a breakpoint token` at `xl` for `<Box p={{ base: '2', xl: '3' }}>`, one at `'nope'` for `<Box states={{ hover: { bg: 'nope' } }}>`, one `w=\"nope\" is not a size or space token` for `<Box w=\"nope\">`, and none for `<Box p=\"2\" direction=\"column\">` or `<Text fg={tone}>x</Text>`."
// Spec: k.a11y-static, clause "In a project with no `tokens.ts`, `keel check` reports for `<Box p=\"2\" direction=\"column\" look=\"card\">` exactly two E1801: `p=\"2\" is not a space token: the project has no tokens.ts` at `\"2\"` and `look=\"card\" is not a look token: the project has no tokens.ts` at `\"card\"`; in a project whose `tokens.ts` throws it reports one E1807 and no E1801; a test file's `<Box p=\"nope\">` reports none."
// Spec: k.a11y-static, clause "`keel check` in a project whose `tokens.ts` exports no `tokens`, throws, reports one E1807 at `tokens.ts` line 1, column 1, and with `color: { fg: 5 }` one at the `fg` key, each with no E1804, and exits 1; in a project with no `tokens.ts` it reports neither for `<Box bg=\"bg\"><Text fg=\"low\">x</Text></Box>`, and two E1801, at `\"bg\"` and at `\"low\"`, and exits 1."
// Spec: k.ui, clause "In a project with no `tokens.ts`, `<Box p=\"2\" direction=\"column\">` is one E1801 at `\"2\"` and none at `\"column\"`; with `brandTokens`, `<Text fg=\"nope\">x</Text>` is one E1801 at `\"nope\"` and `<Text fg=\"text\">x</Text>` none."
// Seed: 1337 (the table of props and groups is finite and visited whole; the unknown names are drawn at that seed).
// The library `check()` over source text, as the folder's other cases: "a project with no `tokens.ts`" is a file list holding none and no `artifacts.tokens`; "a project whose `tokens.ts` is E1807" is a file list holding a `tokens.ts` that throws and no `artifacts.tokens` (the RFC: a name is judged against nothing never). The CLI halves (exit status, E1807 itself) are in packages/cli/conformance/a11y-static-contrast-cli.test.ts.
// Assumed: a diagnostic's `line` and `col` are 1-based and point at the opening quote of a string literal and at the first character of a responsive key; the clip of `<value>` at 20 units keeps 17 and `...`, as k.check Diagnostics' clip does at every width; `brandTokens` has `text` and `card` colors and the space tokens `2` and `3`.
// Not asserted (untestable from the text): "A library file in an app is read as the app's" is not a Conformance sentence; `keyword` props are asserted only as "no E1801" with a nonsense value, since their type, not check, closes them.
import { check } from "@keel/check";
import { defineTokens } from "@keel/ui/tokens";
import { brandTokens } from "@keel/ui/brand";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, one } from "./support.ts";

const HEAD = "import { Box, Text, Input } from '@keel/ui'\nimport { Part } from '@keel/ui/aria'\nconst tone = 'x'\n";
const page = (jsx: string): string => `${HEAD}export default function C() { return ${jsx} }\n`;
type Opts = Parameters<typeof check>[1];
const BRAND: Opts = { types: false, artifacts: { tokens: brandTokens } };
const NONE: Opts = { types: false };
const e1801 = (files: ReturnType<typeof one>, opts: Opts) =>
  check(files, opts).diagnostics.filter((d) => d.code === "E1801");
/** 1-based line and column of the first `needle` in `source`. */
const where = (source: string, needle: string): { line: number; col: number } => {
  const i = source.indexOf(needle);
  expect(i, needle).toBeGreaterThanOrEqual(0);
  const before = source.slice(0, i);
  return { line: before.split("\n").length, col: i - before.lastIndexOf("\n") };
};
const clip = (v: string): string => (v.length > 20 ? `${v.slice(0, 17)}...` : v);

describe("k.a11y-static Token names: with `brandTokens`", () => {
  it('`<Text fg="nope">x</Text>` is one E1801 `fg="nope" is not a color token` at `"nope"`', () => {
    const src = page('<Text fg="nope">x</Text>');
    const d = e1801(one(src), BRAND);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({
      code: "E1801",
      path: "C.tsx",
      message: 'fg="nope" is not a color token',
      ...where(src, '"nope"'),
    });
    expect(d[0]?.fix).toBeUndefined();
  });

  it("`<Box p={{ base: '2', xl: '3' }}>` is one E1801 `breakpoint \"xl\" is not a breakpoint token` at `xl`", () => {
    const src = page("<Box p={{ base: '2', xl: '3' }}>x</Box>");
    const d = e1801(one(src), BRAND);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ message: 'breakpoint "xl" is not a breakpoint token', ...where(src, "xl:") });
    expect(d[0]?.fix).toBeUndefined();
  });

  it("`<Box states={{ hover: { bg: 'nope' } }}>` is one E1801 at `'nope'`", () => {
    const src = page("<Box states={{ hover: { bg: 'nope' } }}>x</Box>");
    const d = e1801(one(src), BRAND);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ message: 'bg="nope" is not a color token', ...where(src, "'nope'") });
  });

  it('`<Box w="nope">` is one E1801 `w="nope" is not a size or space token`', () => {
    const src = page('<Box w="nope">x</Box>');
    const d = e1801(one(src), BRAND);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ message: 'w="nope" is not a size or space token', ...where(src, '"nope"') });
  });

  it('`<Box p="2" direction="column">` and `<Text fg={tone}>x</Text>` report no E1801', () => {
    expect(e1801(one(page('<Box p="2" direction="column">x</Box>')), BRAND)).toEqual([]);
    expect(e1801(one(page("<Text fg={tone}>x</Text>")), BRAND)).toEqual([]);
  });

  it("a token name in a responsive object's value, and in a part style of `styles`, is judged; the key `base` is not", () => {
    const resp = page("<Box p={{ base: 'nope' }}>x</Box>");
    expect(e1801(one(resp), BRAND).map((d) => ({ line: d.line, col: d.col }))).toEqual([where(resp, "'nope'")]);
    const part = page("<Input label=\"L\" styles={{ field: { p: 'nope' } }} />");
    expect(e1801(one(part), BRAND).map((d) => ({ line: d.line, col: d.col }))).toEqual([where(part, "'nope'")]);
    expect(e1801(one(page("<Box p={{ base: '2' }}>x</Box>")), BRAND)).toEqual([]);
  });

  it("a `Part` is judged as a base element", () => {
    const src = page('<Part role="cell" fg="nope">x</Part>');
    expect(e1801(one(src), BRAND).map((d) => d.message)).toEqual(['fg="nope" is not a color token']);
  });

  it("a keyword prop (`direction`, `align`, `justify`, `wrap`, `textAlign`) is not judged by `keel check`", () => {
    const src = page('<Box direction="sideways" align="x" justify="x" wrap="x" textAlign="x">x</Box>');
    expect(e1801(one(src), BRAND)).toEqual([]);
  });
});

describe("k.a11y-static Token names: each prop is judged against its groups", () => {
  const GROUPS: Record<string, string[]> = {
    p: ["space"],
    px: ["space"],
    py: ["space"],
    m: ["space"],
    mx: ["space"],
    my: ["space"],
    gap: ["space"],
    w: ["size", "space"],
    h: ["size", "space"],
    bg: ["color"],
    fg: ["color"],
    radius: ["radius"],
    font: ["font"],
    fontSize: ["fontSize"],
    weight: ["weight"],
    shadow: ["shadow"],
    border: ["border"],
  };
  const VALUE: Record<string, string> = {
    color: "#111111",
    space: "4px",
    size: "10px",
    radius: "4px",
    font: "system-ui",
    fontSize: "14px",
    weight: "700",
    shadow: "0 0 1px #000",
    border: "1px solid #111111",
  };
  const tokens = Object.fromEntries(Object.entries(VALUE).map(([g, v]) => [g, { [`${g}Tok`]: v }]));
  const O: Opts = { types: false, artifacts: { tokens } };

  it('a name is judged against the groups of its prop (`w` and `h`: `size`, then `space`; the rest: the group of their name): one E1801 with the message `<prop>="<value>" is not a <groups> token` for a name of another group, none for a name of its own', () => {
    for (const [prop, groups] of Object.entries(GROUPS)) {
      for (const g of Object.keys(VALUE)) {
        const src = page(`<Box ${prop}="${g}Tok" direction="column">x</Box>`);
        const d = e1801(one(src), O);
        if (groups.includes(g)) expect(d, `${prop} of ${g}`).toEqual([]);
        else {
          expect(d, `${prop} of ${g}`).toHaveLength(1);
          expect(d[0]?.message).toBe(`${prop}="${g}Tok" is not a ${groups.join(" or ")} token`);
          expect(d[0]).toMatchObject(where(src, `"${g}Tok"`));
        }
      }
    }
  });

  it("property: a name no group holds is one E1801 whose `<value>` is clipped at 20 units, and the message fits 89 units", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{1,40}$/), (v) => {
        fc.pre(v !== "colorTok");
        const d = e1801(one(page(`<Text fg="${v}">x</Text>`)), O);
        expect(d).toHaveLength(1);
        expect(d[0]?.message).toBe(`fg="${clip(v)}" is not a color token`);
        expect((d[0]?.message ?? "").length).toBeLessThanOrEqual(89);
      }),
      { seed: SEED, numRuns: 50 },
    );
  });

  it("property: a breakpoint key no `breakpoint` token names is one E1801, `<value>` clipped at 20 units, within 89 units with the no-`tokens.ts` suffix", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{1,40}$/), (k) => {
        fc.pre(k !== "base");
        const withBp: Opts = { types: false, artifacts: { tokens: { ...tokens, breakpoint: { md: "768px" } } } };
        const src = page(`<Box p={{ base: 'spaceTok', ${k}: 'spaceTok' }}>x</Box>`);
        const d = e1801(one(src), withBp);
        if (k === "md") expect(d).toEqual([]);
        else expect(d.map((x) => x.message)).toEqual([`breakpoint "${clip(k)}" is not a breakpoint token`]);
        const none = e1801(one(src), NONE);
        for (const x of none) expect(x.message.length).toBeLessThanOrEqual(89);
      }),
      { seed: SEED, numRuns: 40 },
    );
  });

  it('`look="nope"` is one E1801 `look="nope" is not a look token` at `"nope"`; a look `look` declares is none', () => {
    const t = defineTokens({ space: { 2: "8px" }, look: { primary: { p: "2" } } });
    const o: Opts = { types: false, artifacts: { tokens: t } };
    const src = page('<Box look="nope">x</Box>');
    const d = e1801(one(src), o);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ message: 'look="nope" is not a look token', ...where(src, '"nope"') });
    expect(e1801(one(page('<Box look="primary">x</Box>')), o)).toEqual([]);
  });
});

describe("k.a11y-static Token names: with no `tokens.ts`", () => {
  it('`<Box p="2" direction="column" look="card">` is exactly two E1801: `p="2" is not a space token: the project has no tokens.ts` at `"2"` and `look="card" is not a look token: the project has no tokens.ts` at `"card"`', () => {
    const src = page('<Box p="2" direction="column" look="card">x</Box>');
    const d = e1801(one(src), NONE);
    expect(d.map((x) => [x.message, x.line, x.col])).toEqual([
      ['p="2" is not a space token: the project has no tokens.ts', where(src, '"2"').line, where(src, '"2"').col],
      [
        'look="card" is not a look token: the project has no tokens.ts',
        where(src, '"card"').line,
        where(src, '"card"').col,
      ],
    ]);
  });

  it('`<Box p="2" direction="column">` is one E1801 at `"2"` and none at `"column"`', () => {
    const src = page('<Box p="2" direction="column">x</Box>');
    const d = e1801(one(src), NONE);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject(where(src, '"2"'));
  });

  it('`<Box bg="bg"><Text fg="low">x</Text></Box>` reports neither E1807 nor E1804, and two E1801, at `"bg"` and at `"low"`', () => {
    const src = page('<Box bg="bg"><Text fg="low">x</Text></Box>');
    const r = check(one(src), NONE).diagnostics;
    expect(r.filter((d) => d.code === "E1807" || d.code === "E1804")).toEqual([]);
    expect(r.filter((d) => d.code === "E1801").map((d) => ({ line: d.line, col: d.col }))).toEqual([
      where(src, '"bg"'),
      where(src, '"low"'),
    ]);
  });

  it('a responsive key is E1801 with the suffix too: `breakpoint "xl" is not a breakpoint token: the project has no tokens.ts`', () => {
    const d = e1801(one(page("<Box p={{ base: 'a', xl: 'b' }}>x</Box>")), NONE);
    expect(d.map((x) => x.message)).toContain(
      'breakpoint "xl" is not a breakpoint token: the project has no tokens.ts',
    );
  });

  it("a project that writes no token name, or only computed ones, reports no E1801", () => {
    expect(e1801(one(page('<Box direction="column"><Text fg={tone}>x</Text></Box>')), NONE)).toEqual([]);
  });

  it('a test file\'s `<Box p="nope">` reports none', () => {
    const src = page('<Box p="nope">x</Box>');
    expect(e1801([{ path: "modules/a/C.test.tsx", source: src }], NONE)).toEqual([]);
    expect(e1801([{ path: "modules/a/C.test.tsx", source: src }], BRAND)).toEqual([]);
  });
});

describe("k.a11y-static Token names: with a `tokens.ts` that is E1807", () => {
  it('no name is judged: a `tokens.ts` that throws, with no tokens artifact, leaves `<Box p="2">` and `look="card"` with no E1801', () => {
    const files = [
      { path: "C.tsx", source: page('<Box p="2" look="card">x</Box>') },
      { path: "tokens.ts", source: "throw new Error('broken')\n" },
    ];
    expect(e1801(files, NONE)).toEqual([]);
  });
});

describe("k.ui: Style props and Rules, E1801 at a use", () => {
  it('in a project with no `tokens.ts`, `<Box p="2" direction="column">` is one E1801 at `"2"` and none at `"column"`', () => {
    const src = page('<Box p="2" direction="column">x</Box>');
    const d = e1801(one(src), NONE);
    expect(d.map((x) => ({ line: x.line, col: x.col }))).toEqual([where(src, '"2"')]);
    expect(d.some((x) => x.col === where(src, '"column"').col)).toBe(false);
  });

  it('with `brandTokens`, `<Text fg="nope">x</Text>` is one E1801 at `"nope"` and `<Text fg="text">x</Text>` none', () => {
    const bad = page('<Text fg="nope">x</Text>');
    expect(e1801(one(bad), BRAND).map((x) => ({ line: x.line, col: x.col }))).toEqual([where(bad, '"nope"')]);
    expect(e1801(one(page('<Text fg="text">x</Text>')), BRAND)).toEqual([]);
  });
});
