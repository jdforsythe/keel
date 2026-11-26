// Spec: k.looks, clause "In the fixture with `tokens.ts` `import { brandTokens } from \"@keel/ui/brand\";` and `export const tokens = brandTokens;`, `keel check` reports one E1810 at `tokens` with message `@acme/ui needs color \"acme.accent\" and 2 more; import acmeTokens from @acme/ui/tokens` and no E1801."
// Spec: k.looks, clause "Applying that fix makes `tokens` `defineTokens({ ...brandTokens, color: { ...brandTokens.color, ...acmeTokens.color }, look: { ...brandTokens.look, ...acmeTokens.look } })` with `defineTokens` and `acmeTokens` imported, and the next `keel check` reports no diagnostic."
// Spec: k.looks, clause "In the fixed project with `'acme.accent': '#b8420d'` after `...acmeTokens.color`, `keel check` reports no diagnostic and `keel build`'s CSS holds `--k-color-acme-accent:#b8420d` and no `#0B5CAD`."
// Spec: k.looks, clause "In the fixed project, a `color` key `'acme.acent': '#000000'` is one E1813 with message `color \"acme.acent\": @acme/ui ships no such token`, and a key `'zed.x': '#000000'` is one E1813 with message `color \"zed.x\": no library the app lists has id zed`."
// Spec: k.looks, clause "In the fixed project with the `look` spread removed, `keel check` reports one E1810 with message `@acme/ui needs look \"acme.badge\"; spread acmeTokens.look`."
// Spec: k.looks, clause "In the fixture with no `tokens.ts`, `keel check` reports one E1810 at the `'@acme/ui'` entry, with no fix."
// Spec: k.looks, clause "E1810 to E1814 judge the tokens k.a11y-static Tokens gives the project, the evaluated `tokens` export of its `tokens.ts`, and read the file's text only for positions and the fix; a project whose `tokens.ts` gives no tokens (E1807, or `check()` given the file and no tokens artifact) has none of them judged but E1811 and E1812, which read the library's own files and no tokens, and one with no `tokens.ts` has no tokens, one scheme (`light`) and no dotted names."
// Spec: k.looks, clause "E1810 a listed library's needed name the app's tokens lack (Message; fix: Fix)"
// Spec: k.looks, clause "E1813 a name with a `.` in the app's tokens that no listed library ships, or a fixture key overriding a default (In an app, Own folder; fix: none)" (the app half; the fixture half is library-looks-own-folder.test.ts).
// Seed: 1337 (fc.assert below). The CSS half of the third clause (`keel build`) is asserted over `compileStyles` of the composed tokens; the build itself is an end-to-end case.
// ASSUMPTIONS: see library-looks-support.ts. E1810 to E1814 judge the evaluated tokens `check()` is given as `artifacts: { tokens }` and read `tokens.ts`'s text for positions and the fix (k.looks In an app); the fix's layout is not judged, so the fixed file and the expected one are compared after `biome format` (k.looks Fix).
import { defineTokens } from "@keel/ui";
import { brandTokens } from "@keel/ui/brand";
import { compileStyles } from "@keel/ui/css";
import fc from "fast-check";
import { expect, test } from "vitest";
import { CHECK_CASE_BOUND } from "./check-time.ts";
import {
  BRAND_ONLY,
  ROOT,
  SEED,
  SHIPPED,
  acme,
  app,
  applyFix,
  atText,
  badgeSource,
  codesOf,
  composed,
  diagnosticsOf,
  fixedTokens,
  formatted,
  positionOf,
  shippedSource,
  sourceOf,
} from "./library-looks-support.ts";

const TOKENS = "tokens.ts";

test(
  'In the fixture with `tokens.ts` `import { brandTokens } from "@keel/ui/brand";` and `export const tokens = brandTokens;`, `keel check` reports one E1810 at `tokens` with message `@acme/ui needs color "acme.accent" and 2 more; import acmeTokens from @acme/ui/tokens` and no E1801',
  () => {
    const files = app(BRAND_ONLY);
    const all = diagnosticsOf(files, brandTokens);
    const d = all.filter((x) => x.code === "E1810");
    expect(d).toHaveLength(1);
    expect(d[0]?.message).toBe('@acme/ui needs color "acme.accent" and 2 more; import acmeTokens from @acme/ui/tokens');
    expect(d[0]?.path).toBe(TOKENS);
    expect(
      atText(sourceOf(files, TOKENS), "tokens", d[0]?.line ?? 0, d[0]?.col ?? 0, BRAND_ONLY.indexOf("export const")),
    ).toBe(true);
    expect(all.filter((x) => x.code === "E1801")).toEqual([]);
  },
  CHECK_CASE_BOUND,
);

test(
  "a project whose `tokens.ts` gives no tokens (`check()` given the file and no tokens artifact) has none of E1810, E1813 and E1814 judged",
  () => {
    const cases = [
      app(BRAND_ONLY),
      app(fixedTokens("", "")),
      app(fixedTokens(", 'zed.x': '#000000'")),
      app(fixedTokens(", 'acme.acent': '#000000'")),
    ];
    for (const files of cases) {
      const codes = diagnosticsOf(files).map((d) => d.code);
      for (const code of ["E1810", "E1813", "E1814"]) expect(codes).not.toContain(code);
    }
  },
  CHECK_CASE_BOUND,
);

test(
  "E1811 and E1812 are judged with `tokens.ts` and no tokens artifact: they read the library's own files and no tokens",
  () => {
    const e1811 = diagnosticsOf(app(fixedTokens(), [{ path: `${ROOT}/src/Badge.tsx`, source: badgeSource(' p="2"') }]));
    expect(e1811.filter((d) => d.code === "E1811").map((d) => d.message)).toEqual(['p="2" is not in acmeTokens']);
    const spread = shippedSource("...other, 'acme.accent': '#0B5CAD', 'acme.ink': '#FFFFFF'");
    const e1812 = diagnosticsOf(app(fixedTokens(), [{ path: SHIPPED, source: spread }]));
    expect(e1812.filter((d) => d.code === "E1812").map((d) => d.message)).toEqual([
      "acmeTokens.ts holds a spread; it is one defineTokens literal",
    ]);
  },
  CHECK_CASE_BOUND,
);

test(
  "Applying that fix makes `tokens` `defineTokens({ ...brandTokens, color: { ...brandTokens.color, ...acmeTokens.color }, look: { ...brandTokens.look, ...acmeTokens.look } })` with `defineTokens` and `acmeTokens` imported, and the next `keel check` reports no diagnostic",
  () => {
    const files = app(BRAND_ONLY);
    const fix = diagnosticsOf(files, brandTokens).find((x) => x.code === "E1810")?.fix;
    expect(fix).toBeDefined();
    const patched = applyFix(files, fix ?? "");
    const text = sourceOf(patched, TOKENS);
    expect(text).toContain("defineTokens");
    expect(text).toContain("acmeTokens");
    expect(formatted(text)).toBe(formatted(fixedTokens()));
    expect(diagnosticsOf(patched, composed())).toEqual([]);
  },
  CHECK_CASE_BOUND,
);

test("the fix names no file under `node_modules/` and edits `tokens.ts` alone", () => {
  const fix = diagnosticsOf(app(BRAND_ONLY), brandTokens).find((x) => x.code === "E1810")?.fix ?? "";
  const names = fix.split("\n").filter((l) => l.startsWith("--- ") || l.startsWith("+++ "));
  expect(names.length).toBeGreaterThan(0);
  for (const l of names) expect(l).toMatch(/tokens\.ts$/);
});

test(
  "In the fixed project with `'acme.accent': '#b8420d'` after `...acmeTokens.color`, `keel check` reports no diagnostic and `keel build`'s CSS holds `--k-color-acme-accent:#b8420d` and no `#0B5CAD`",
  () => {
    const files = app(fixedTokens(", 'acme.accent': '#b8420d'"));
    const tokens = composed({ "acme.accent": "#b8420d" });
    expect(diagnosticsOf(files, tokens)).toEqual([]);
    // The build half: the composed object the file evaluates to, compiled as `keel build` compiles tokens.
    const css = compileStyles({ tokens, usages: [{ props: { look: "acme.badge" } }] }).css;
    expect(css.replace(/\s+/g, "")).toContain("--k-color-acme-accent:#b8420d");
    expect(css).not.toContain("#0B5CAD");
  },
  CHECK_CASE_BOUND,
);

test(
  "In the fixed project, a `color` key `'acme.acent': '#000000'` is one E1813 with message `color \"acme.acent\": @acme/ui ships no such token`, at the opening quote of the first string literal holding the name",
  () => {
    const files = app(fixedTokens(", 'acme.acent': '#000000'"));
    const source = sourceOf(files, TOKENS);
    const d = codesOf(files, "E1813", composed({ "acme.acent": "#000000" }));
    expect(d).toHaveLength(1);
    expect(d[0]?.message).toBe('color "acme.acent": @acme/ui ships no such token');
    expect(d[0]?.path).toBe(TOKENS);
    expect({ line: d[0]?.line, col: d[0]?.col }).toEqual(positionOf(source, "'acme.acent'"));
    expect(d[0]?.fix).toBeUndefined();
  },
  CHECK_CASE_BOUND,
);

test(
  "E1813 sits at the opening quote of the first string literal whose value is the name, whichever quote it is written with and wherever in the file the literal stands",
  () => {
    const head = (extra: string) => fixedTokens().replace("\nexport const tokens", `${extra}\nexport const tokens`);
    const tokens = composed({ "zed.x": "#000000" });
    // An earlier literal that is not a key holds the name: that literal is the position.
    const early = app(head('const note = "zed.x";'));
    const earlyText = sourceOf(early, TOKENS);
    const d1 = codesOf(early, "E1813", tokens);
    expect(d1).toHaveLength(1);
    expect({ line: d1[0]?.line, col: d1[0]?.col }).toEqual(positionOf(earlyText, '"zed.x"'));
    // A double-quoted key is positioned at its own opening quote.
    const dq = app(fixedTokens(', "zed.x": "#000000"'));
    const d2 = codesOf(dq, "E1813", tokens);
    expect(d2).toHaveLength(1);
    expect({ line: d2[0]?.line, col: d2[0]?.col }).toEqual(positionOf(sourceOf(dq, TOKENS), '"zed.x"'));
  },
  CHECK_CASE_BOUND,
);

test(
  "E1813 sits at line 1, column 1 when no string literal in `tokens.ts` has the name as its value",
  () => {
    const files = app(fixedTokens(", ['zed.' + 'x']: '#000000'"));
    const d = codesOf(files, "E1813", composed({ "zed.x": "#000000" }));
    expect(d).toHaveLength(1);
    expect(d[0]?.message).toBe('color "zed.x": no library the app lists has id zed');
    expect(d[0]?.path).toBe(TOKENS);
    expect({ line: d[0]?.line, col: d[0]?.col }).toEqual({ line: 1, col: 1 });
  },
  CHECK_CASE_BOUND,
);

test(
  "In the fixed project, a key `'zed.x': '#000000'` is one E1813 with message `color \"zed.x\": no library the app lists has id zed`, at the opening quote of the literal",
  () => {
    const files = app(fixedTokens(", 'zed.x': '#000000'"));
    const d = codesOf(files, "E1813", composed({ "zed.x": "#000000" }));
    expect(d).toHaveLength(1);
    expect(d[0]?.message).toBe('color "zed.x": no library the app lists has id zed');
    expect({ line: d[0]?.line, col: d[0]?.col }).toEqual(positionOf(sourceOf(files, TOKENS), "'zed.x'"));
    expect(d[0]?.fix).toBeUndefined();
  },
  CHECK_CASE_BOUND,
);

test(
  "a key with a `.` that no listed library ships is E1813, whatever its id and name; a key naming a token the library ships is not",
  () => {
    const word = fc.stringMatching(/^[a-z]{3,8}$/);
    fc.assert(
      fc.property(word, word, (id, name) => {
        fc.pre(id !== "acme");
        const zed = codesOf(
          app(fixedTokens(`, '${id}.${name}': '#000000'`)),
          "E1813",
          composed({ [`${id}.${name}`]: "#000000" }),
        );
        expect(zed.map((d) => d.message)).toEqual([`color "${id}.${name}": no library the app lists has id ${id}`]);
        fc.pre(name !== "accent" && name !== "ink");
        const own = codesOf(
          app(fixedTokens(`, 'acme.${name}': '#000000'`)),
          "E1813",
          composed({ [`acme.${name}`]: "#000000" }),
        );
        expect(own.map((d) => d.message)).toEqual([`color "acme.${name}": @acme/ui ships no such token`]);
      }),
      { seed: SEED, numRuns: 5 },
    );
  },
  CHECK_CASE_BOUND,
);

test(
  'In the fixed project with the `look` spread removed, `keel check` reports one E1810 with message `@acme/ui needs look "acme.badge"; spread acmeTokens.look`',
  () => {
    const d = codesOf(app(fixedTokens("", "")), "E1810", composed({}, false));
    expect(d).toHaveLength(1);
    expect(d[0]?.message).toBe('@acme/ui needs look "acme.badge"; spread acmeTokens.look');
  },
  CHECK_CASE_BOUND,
);

test("a dropped group is one E1810 for the library naming the first missing name, groups in k.ui's order with `look` last, `and <n> more` counting the rest", () => {
  const noColor = `import { defineTokens } from "@keel/ui";\nimport { brandTokens } from "@keel/ui/brand";\nimport { acmeTokens } from "@acme/ui/tokens";\nexport const tokens = defineTokens({ ...brandTokens, look: { ...brandTokens.look, ...acmeTokens.look } });\n`;
  const evaluated = defineTokens({
    ...brandTokens,
    look: { ...brandTokens.look, "acme.badge": { bg: "acme.accent", fg: "acme.ink" } },
  });
  const d = codesOf(app(noColor), "E1810", evaluated);
  expect(d).toHaveLength(1);
  expect(d[0]?.message).toBe('@acme/ui needs color "acme.accent" and 1 more; spread acmeTokens.color');
});

test(
  "In the fixture with no `tokens.ts`, `keel check` reports one E1810 at the `'@acme/ui'` entry, with no fix",
  () => {
    const files = app(undefined);
    const d = codesOf(files, "E1810");
    expect(d).toHaveLength(1);
    expect(d[0]?.path).toBe("modules/shop/module.ts");
    expect(atText(sourceOf(files, "modules/shop/module.ts"), "'@acme/ui'", d[0]?.line ?? 0, d[0]?.col ?? 0)).toBe(true);
    expect(d[0]?.fix).toBeUndefined();
  },
  CHECK_CASE_BOUND,
);

test(
  "a project with no `tokens.ts` has no tokens, one scheme (`light`) and no dotted names: a `SchemeSelect` is E1814 and no E1813 is reported",
  () => {
    const select = {
      path: "modules/shop/Select.tsx",
      source:
        "import { SchemeSelect } from '@keel/ui'\nexport default function S() { return <SchemeSelect id=\"scheme\" label=\"Scheme\" labels={{ system: 'System', light: 'Light', dark: 'Dark' }} /> }\n",
    };
    const all = diagnosticsOf([...app(undefined), select]);
    expect(all.filter((d) => d.code === "E1813")).toEqual([]);
    expect(all.filter((d) => d.code === "E1814").map((d) => d.message)).toEqual([
      "SchemeSelect needs schemes light and dark; the tokens have light only",
    ]);
  },
  CHECK_CASE_BOUND,
);

test(
  "an app that lists no library with a `./tokens` entry has no E1810, with or without `tokens.ts`",
  () => {
    const noEntry = acme([
      {
        path: "node_modules/@acme/ui/package.json",
        source: JSON.stringify({
          name: "@acme/ui",
          version: "1.0.0",
          type: "module",
          keel: "library",
          exports: { ".": { keel: "./src/index.ts", default: "./index.js" } },
        }),
      },
    ]);
    for (const tokens of [undefined, BRAND_ONLY]) {
      const files = [...app(tokens).filter((f) => !f.path.startsWith("node_modules/")), ...noEntry];
      expect(codesOf(files, "E1810", tokens === undefined ? undefined : brandTokens)).toEqual([]);
    }
  },
  CHECK_CASE_BOUND,
);
