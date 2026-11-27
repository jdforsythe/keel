// Spec: k.themes, clause "With `tokens.ts` holding, at its line 4, column 5, the key of `light: {}` in `themes`, of `text: { light: '#000000', dark: '#ffffff' }` in the `color` of a theme `paper` with `when: 'print'`, or of `accent: 'rgb(184, 66, 13)'` in `color`, each alone, `keel check --format=json` reports one E1807 at line 4, column 5 with, in turn, message `themes.light: default, system, light and dark are reserved` and `see` `k.themes`, `themes.paper.color.text: a print theme takes one value, not a pair` and `k.themes`, and `color.accent: channels are separated by spaces, not commas` and `k.values`."
// Spec: k.themes, clause "With `color: { ...designTokens.color, text: '#222222' }` in `tokens.ts` and `designTokens.color.ink` `'red'`, the one E1807 is at that spread's `...` with message `color.ink: a named color; write hex or a function form`; a `tokens.ts` that throws `new Error('boom')` is one E1807 at line 1, column 1 with message `tokens.ts throws: boom`; with a color token named by 80 `x`s given a pair in a `print` theme `paper`, the message is at most 89 units and ends `: a print theme takes one value, not a pair`, in compact and in `--format=json`, and an E1817 for an overlay named by 80 `s`s ends `, not in its over`."
// Paragraph k.themes Token errors (no Conformance sentence of its own): the closed list of `<what>` texts, each with the `see` of the section holding its rule; asserted below as a table, one case per entry, at the key the issue path's last segment names.
// Seed: 1337 (fc.assert below). No `test.skip`: the cases are plain tests and fail until the build follows.
// The binary runs `keel check` over a temp project (token-errors-support.ts): a `@@` marks the expected position. The `tokens` export is written as a plain object, so `keel check` judges it as `TokenSchema` reads it. The E1817 half of the second clause (a message through `check()`) is packages/check/conformance/theme-message-fit.test.ts.
// ASSUMED: a diagnostic record is `{ kind: "diag", code, path, line, col, message, see }`; a path's last segment is the key a message is at; for `<group> takes no theme` the path ends at the group's key, for `not a top-level <group> token` at the token's key; the `under 3:1` case writes `base.focus` as a color.
// Untestable here: the E1810 theme message, E1816 and E1817 "each name in them, the longest first, keeps its first units and `...`" for names of mixed lengths: only the one-name case the clause gives is asserted (check package).
import { afterAll, describe, expect, it } from "vitest";
import fc from "fast-check";
import { fixedTime } from "@keel/tooling/test-time";
import { SEED, cleanProjects, compact, diagsOf, keel, marked, project } from "./token-errors-support.ts";

afterAll(cleanProjects);
const T = fixedTime(180_000);
const wrap = (body: string): string => `export const tokens = {\n${body}\n};\n`;

type Row = { name: string; body: string; message: string; see: string };
const run = (src: string, extra: Record<string, string> = {}) => {
  const m = marked(src);
  return { m, run: keel(project("e1807", m.source, extra), ["check"]) };
};

describe("k.themes: E1807 sits at the key and says `<path>: <what>`", () => {
  const clause: Row[] = [
    {
      name: "`light: {}` in `themes`",
      body: `  // keys\n  themes: {\n    @@light: {},\n  },`,
      message: "themes.light: default, system, light and dark are reserved",
      see: "k.themes",
    },
    {
      name: "`text: { light: '#000000', dark: '#ffffff' }` in the `color` of a theme `paper` with `when: 'print'`",
      body: `  color: { text: "#111111" },\n  themes: { paper: { when: "print", color: {\n    @@text: { light: "#000000", dark: "#ffffff" } } } },`,
      message: "themes.paper.color.text: a print theme takes one value, not a pair",
      see: "k.themes",
    },
    {
      name: "`accent: 'rgb(184, 66, 13)'` in `color`",
      body: `  // keys\n  color: {\n    @@accent: "rgb(184, 66, 13)",\n  },`,
      message: "color.accent: channels are separated by spaces, not commas",
      see: "k.values",
    },
  ];
  for (const row of clause) {
    it(
      `${row.name}, alone, is one E1807 at line 4, column 5 with message \`${row.message}\` and \`see\` \`${row.see}\``,
      () => {
        const { m, run: r } = run(wrap(row.body));
        const d = diagsOf(r, "E1807");
        expect(d).toHaveLength(1);
        expect(m).toMatchObject({ line: 4, col: 5 });
        expect(d[0]).toMatchObject({ path: "tokens.ts", line: 4, col: 5, message: row.message, see: row.see });
        expect(r.status).toBe(1);
      },
      T,
    );
  }
});

describe("k.themes: every message of the closed list, at its key, with its `see`", () => {
  const nine = Array.from({ length: 8 }, (_, i) => `t${i + 1}: {}`).join(", ");
  const table: Row[] = [
    {
      name: "a theme name",
      body: `  themes: {\n    @@"a-b": {},\n  },`,
      message: "themes.a-b: a theme name is a letter then up to 23 letters and digits",
      see: "k.themes",
    },
    {
      name: "`when`",
      body: `  themes: { a: {\n    @@when: "hover" } },`,
      message: "themes.a.when: when is choice, contrast or print",
      see: "k.themes",
    },
    {
      name: "a group that takes no theme",
      body: `  themes: { a: {\n    @@breakpoint: { md: "1px" } } },`,
      message: "themes.a.breakpoint: breakpoint takes no theme",
      see: "k.themes",
    },
    {
      name: "a name no top-level group holds",
      body: `  color: { text: "#111111" },\n  themes: { a: { color: {\n    @@nope: "#000000" } } },`,
      message: "themes.a.color.nope: not a top-level color token",
      see: "k.themes",
    },
    {
      name: "a second contrast theme",
      body: `  themes: { a: { when: "contrast" },\n    @@b: { when: "contrast" } },`,
      message: "themes.b: a second contrast theme",
      see: "k.themes",
    },
    {
      name: "a second print theme",
      body: `  themes: { a: { when: "print" },\n    @@b: { when: "print" } },`,
      message: "themes.b: a second print theme",
      see: "k.themes",
    },
    {
      name: "a ninth choice theme",
      body: `  themes: { ${nine},\n    @@t9: {} },`,
      message: "themes.t9: a ninth choice theme; at most 8",
      see: "k.themes",
    },
    {
      name: "a named color",
      body: `  color: {\n    @@a: "red" },`,
      message: "color.a: a named color; write hex or a function form",
      see: "k.values",
    },
    {
      name: "alpha on a color",
      body: `  color: {\n    @@a: "#1a191e99" },`,
      message: "color.a: alpha is for an overlay or a shadow",
      see: "k.values",
    },
    {
      name: "an `over` naming no color token",
      body: `  color: { card: "#ffffff" },\n  overlay: { scrim: { value: "#1a191e99",\n    @@over: ["nope"] } },`,
      message: 'overlay.scrim.over: names no color token "nope"',
      see: "k.values",
    },
    {
      name: "an empty `over`",
      body: `  color: { card: "#ffffff" },\n  overlay: { scrim: { value: "#1a191e99",\n    @@over: [] } },`,
      message: "overlay.scrim.over: holds 1 to 8 distinct names",
      see: "k.values",
    },
    {
      name: "any other refused value",
      body: `  space: {\n    @@a: "-2rem" },`,
      message: "space.a: not a space value",
      see: "k.values",
    },
    {
      name: "`schemes`",
      body: `  color: { text: "#111111" },\n  @@schemes: ["dark", "light"],`,
      message: 'schemes: is ["light"], ["dark"] or ["light", "dark"]',
      see: "k.schemes",
    },
    {
      name: "a key that is no token group",
      body: `  color: { text: "#111111" },\n  @@nope: {},`,
      message: "nope: is no token group",
      see: "k.ui",
    },
  ];
  for (const row of table) {
    it(
      `${row.name} is one E1807 with message \`${row.message}\` at its key and \`see\` \`${row.see}\``,
      () => {
        const { m, run: r } = run(wrap(row.body));
        const d = diagsOf(r, "E1807");
        expect(d).toHaveLength(1);
        expect(d[0]).toMatchObject({ path: "tokens.ts", line: m.line, col: m.col, message: row.message, see: row.see });
      },
      T,
    );
  }

  it(
    "`base.focus` under 3:1 on `base.page`'s bg is `base.focus: under 3:1 on base.page's bg in <combination>`, `see` `k.ui`",
    () => {
      const { m, run: r } = run(
        wrap(
          `  color: { text: "#111111", bg: "#ffffff" },\n  base: { page: { fg: "text", bg: "bg" },\n    @@focus: "#f5f5f5" },`,
        ),
      );
      const d = diagsOf(r, "E1807");
      expect(d).toHaveLength(1);
      expect(d[0]).toMatchObject({ path: "tokens.ts", line: m.line, col: m.col, see: "k.ui" });
      expect(String(d[0]?.message).startsWith("base.focus: under 3:1 on base.page's bg in ")).toBe(true);
    },
    T,
  );

  it(
    "E1807 reports the first issue in `TokenSchema`'s order: with two refused values only one E1807 is reported",
    () => {
      const { run: r } = run(wrap(`  color: {\n    a: "red", b: "oops" },`));
      expect(diagsOf(r, "E1807")).toHaveLength(1);
    },
    T,
  );
});

describe("k.themes: E1807 at a spread, a throw and a long path", () => {
  const DESIGN = `export const designTokens = { color: { ink: "red" } };\n`;
  it(
    "With `color: { ...designTokens.color, text: '#222222' }` in `tokens.ts` and `designTokens.color.ink` `'red'`, the one E1807 is at that spread's `...` with message `color.ink: a named color; write hex or a function form`",
    () => {
      const src = `import { designTokens } from "./design.ts";\nexport const tokens = {\n  color: { @@...designTokens.color, text: "#222222" },\n};\n`;
      const { m, run: r } = run(src, { "design.ts": DESIGN });
      const d = diagsOf(r, "E1807");
      expect(d).toHaveLength(1);
      expect(d[0]).toMatchObject({
        path: "tokens.ts",
        line: m.line,
        col: m.col,
        message: "color.ink: a named color; write hex or a function form",
      });
    },
    T,
  );

  it(
    "a `tokens.ts` that throws `new Error('boom')` is one E1807 at line 1, column 1 with message `tokens.ts throws: boom`",
    () => {
      const r = keel(project("e1807-throws", `throw new Error("boom");\nexport const tokens = {};\n`), ["check"]);
      const d = diagsOf(r, "E1807");
      expect(d).toHaveLength(1);
      expect(d[0]).toMatchObject({ path: "tokens.ts", line: 1, col: 1, message: "tokens.ts throws: boom" });
    },
    T,
  );

  it(
    "a `tokens.ts` with no `tokens` export is one E1807 at line 1, column 1 with message `tokens.ts exports no tokens`",
    () => {
      const r = keel(project("e1807-none", "export {};\n"), ["check"]);
      const d = diagsOf(r, "E1807");
      expect(d).toHaveLength(1);
      expect(d[0]).toMatchObject({
        path: "tokens.ts",
        line: 1,
        col: 1,
        message: "tokens.ts exports no tokens",
        see: "k.a11y-static",
      });
    },
    T,
  );

  const longName = (n: number): string => `${"x".repeat(n)}`;
  const longSource = (n: number): string =>
    wrap(
      `  color: { ${longName(n)}: "#111111" },\n  themes: { paper: { when: "print", color: { ${longName(n)}: { light: "#000000", dark: "#ffffff" } } } },`,
    );
  const SUFFIX = ": a print theme takes one value, not a pair";

  it(
    "with a color token named by 80 `x`s given a pair in a `print` theme `paper`, the message is at most 89 units and ends `: a print theme takes one value, not a pair`, in `--format=json`",
    () => {
      const r = keel(project("e1807-long", longSource(80)), ["check"]);
      const d = diagsOf(r, "E1807");
      expect(d).toHaveLength(1);
      const m = String(d[0]?.message);
      expect(m.length).toBeLessThanOrEqual(89);
      expect(m.endsWith(SUFFIX)).toBe(true);
      expect(m.startsWith(".../x")).toBe(true);
    },
    T,
  );

  it(
    "and in compact",
    () => {
      const lines = compact(project("e1807-long-compact", longSource(80))).filter((l) => l.includes("E1807"));
      expect(lines).toHaveLength(1);
      expect(lines[0]?.includes(SUFFIX)).toBe(true);
    },
    T,
  );

  it(
    "whatever the length of the token's name, the message is at most 89 units, never cuts `: <what>` and keeps the name's first units",
    () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 140 }), (n) => {
          const r = keel(project("e1807-len", longSource(n)), ["check"]);
          const m = String(diagsOf(r, "E1807")[0]?.message);
          expect(m.length).toBeLessThanOrEqual(89);
          expect(m.endsWith(SUFFIX)).toBe(true);
        }),
        { seed: SEED, numRuns: 5 },
      );
    },
    fixedTime(600_000),
  );
});
