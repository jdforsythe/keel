// Spec: k.looks, clause "In the fixed project, `p=\"2\"` on the badge's `Text` is one E1811 at the literal with message `p=\"2\" is not in acmeTokens`; with the `./tokens` entry and `src/acmeTokens.ts` removed and `look` dropped, `p=\"2\"` is one E1811 with message `p=\"2\": @acme/ui ships no ./tokens entry`."
// Spec: k.looks, clause "`src/acmeTokens.ts` given a spread `...other` in `color` is one E1812 at the spread with message `acmeTokens.ts holds a spread; it is one defineTokens literal`; a `color` key `'accent'` is one E1812 with message `acmeTokens names color \"accent\" without acme.`; a `\"./tokens\"` `keel` target `./src/tokens.ts` is one E1812 at `exports`."
// Spec: k.looks, clause "In the library's own folder with root `tokens.ts` composing the shipped object as the fix writes it, `keel check` reports one E1804 at the `'acme.badge'` key of `src/acmeTokens.ts` with message `look.acme.badge: fg \"acme.ink\" on bg \"acme.accent\" is 4.42:1 in light, needs 4.5:1` when `acme.accent` is `#787878`, and none when it is `#0B5CAD`."
// Spec: k.looks, clause "In that own folder, a fixture key `'acme.accent': '#000000'` after the spread is one E1813 with message `color \"acme.accent\": the fixture overrides acme's default`, and `keel pack` then reports it and one E1164 naming `check`."
// Rules (k.looks): "E1811 a library file's token name its shipped tokens lack (`<prop>=\"<value>\" is not in <id>Tokens`, `breakpoint \"<key>\" is not in <id>Tokens`, `look=\"<value>\" is not in <id>Tokens`; with no `./tokens` entry each ends `: <name> ships no ./tokens entry` in place of ` is not in <id>Tokens`; `<value>` clipped at 20 units as k.check Diagnostics clips a message (its first 17 units and `...`); fix: none)"
// Rules (k.looks): "E1812 a `./tokens` entry whose `keel` target is not `./src/<id>Tokens.ts`, at `exports` (`./tokens keel target is not ./src/<id>Tokens.ts`), or a shipped tokens file out of form, at the first node out of form (`<id>Tokens.ts holds <what>; it is one defineTokens literal`, `<what>` one of `another import`, `another statement`, `a spread`, `a type assertion` (`as`, `satisfies`), `a computed value`; `<id>Tokens names <group> \"<token>\" without <id>.`; `<id>Tokens holds base`; `<id>Tokens holds schemes`; `look \"<look>\" names <group> \"<token>\", not in <id>Tokens`; `<id>Tokens fails TokenSchema at <path>`; fix: none)"
// Rules (k.looks): "E1813 a name with a `.` in the app's tokens that no listed library ships, or a fixture key overriding a default (In an app, Own folder; fix: none)" (the fixture half; the app half is library-looks-e1810.test.ts).
// Seed: 1337 (fc.assert below). The pack half of the last clause (`keel pack` reports it and one E1164 naming `check`) is packages/cli/conformance/library-looks-pack.test.ts.
// ASSUMPTIONS: see library-looks-support.ts. The own folder is the library's files at the root of the files `check()` is given (k.library-pack Own folder), its root `tokens.ts` importing `./src/acmeTokens.ts`. A shipped-file diagnostic is at the file's own path (`node_modules/@acme/ui/src/acmeTokens.ts` in an app, `src/acmeTokens.ts` in the own folder). ``<value>` of E1811 is clipped as k.check Diagnostics clips a message: at 20 units or fewer it is whole, over 20 its first 17 units and `...`. E1810 to E1814 are judged over the tokens artifact the root `tokens.ts` evaluates to (`composed`).
// AMBIGUOUS: "a spread" is `...other` in a group, `holds schemes` is asserted for `schemes: ['light']`, though an array is also no string or object literal ("a computed value"): the spec does not say which message wins, and the reading asserted is that a key the file may not hold is named first.
import { brandTokens } from "@keel/ui/brand";
import fc from "fast-check";
import { expect, test } from "vitest";
import { CHECK_CASE_BOUND } from "./check-time.ts";
import {
  type Files,
  PACKAGE_JSON,
  ROOT,
  SEED,
  SHIPPED,
  app,
  atText,
  badgeSource,
  codesOf,
  composed,
  diagnosticsOf,
  fixedTokens,
  packageJson,
  packageJsonNoTokens,
  positionOf,
  shippedSource,
  sourceOf,
} from "./library-looks-support.ts";
import { manifestFile } from "./module-support.ts";

const FIXED = fixedTokens();
const e1811 = (props: string, over: Files = [], drop: string[] = []) =>
  codesOf(
    app(FIXED, [{ path: `${ROOT}/src/Badge.tsx`, source: badgeSource(props) }, ...over], drop),
    "E1811",
    composed(),
  );

// ---- E1811
test(
  'In the fixed project, `p="2"` on the badge\'s `Text` is one E1811 at the literal with message `p="2" is not in acmeTokens`',
  () => {
    const files = app(FIXED, [{ path: `${ROOT}/src/Badge.tsx`, source: badgeSource(' p="2"') }]);
    const d = codesOf(files, "E1811", composed());
    expect(d).toHaveLength(1);
    expect(d[0]?.message).toBe('p="2" is not in acmeTokens');
    expect(d[0]?.path).toBe(`${ROOT}/src/Badge.tsx`);
    expect(atText(sourceOf(files, `${ROOT}/src/Badge.tsx`), '"2"', d[0]?.line ?? 0, d[0]?.col ?? 0)).toBe(true);
    expect(d[0]?.fix).toBeUndefined();
    expect(diagnosticsOf(files, composed()).filter((x) => x.code === "E1801")).toEqual([]);
  },
  CHECK_CASE_BOUND,
);

test(
  'with the `./tokens` entry and `src/acmeTokens.ts` removed and `look` dropped, `p="2"` is one E1811 with message `p="2": @acme/ui ships no ./tokens entry`',
  () => {
    const badge = `import { Text } from '@keel/ui'\nexport default function Badge(props: { id: string }) { return <Text id={\`\${props.id}.text\`} p="2">x</Text> }\n`;
    const files = app(
      FIXED,
      [
        { path: PACKAGE_JSON, source: packageJsonNoTokens() },
        { path: `${ROOT}/src/Badge.tsx`, source: badge },
      ],
      [SHIPPED],
    );
    const d = codesOf(files, "E1811", composed({}, false));
    expect(d).toHaveLength(1);
    expect(d[0]?.message).toBe('p="2": @acme/ui ships no ./tokens entry');
    expect(d[0]?.fix).toBeUndefined();
  },
  CHECK_CASE_BOUND,
);

test(
  'a token prop value the shipped tokens lack is one E1811 `<prop>="<value>" is not in acmeTokens`, whatever the value; a name it holds is none',
  () => {
    const value = fc.stringMatching(/^[a-z0-9]{1,8}$/);
    fc.assert(
      fc.property(value, fc.constantFrom("p", "m", "gap", "radius", "fontSize"), (v, prop) => {
        const d = e1811(` ${prop}="${v}"`);
        expect(d.map((x) => x.message)).toEqual([`${prop}="${v}" is not in acmeTokens`]);
      }),
      { seed: SEED, numRuns: 10 },
    );
    expect(e1811(' fg="acme.ink"')).toEqual([]);
  },
  CHECK_CASE_BOUND,
);

test(
  'a responsive key the shipped tokens lack is one E1811 `breakpoint "<key>" is not in acmeTokens`, a `look` it lacks `look="<value>" is not in acmeTokens`, and a `states` value it lacks is judged as a prop',
  () => {
    expect(e1811(' fg={{ md: "acme.ink" }}').map((x) => x.message)).toEqual(['breakpoint "md" is not in acmeTokens']);
    const badLook = codesOf(
      app(FIXED, [
        { path: `${ROOT}/src/Badge.tsx`, source: badgeSource().replace('look="acme.badge"', 'look="nope"') },
      ]),
      "E1811",
      composed(),
    );
    expect(badLook.map((x) => x.message)).toEqual(['look="nope" is not in acmeTokens']);
    expect(e1811(' states={{ hover: { bg: "zzz" } }}').map((x) => x.message)).toEqual([
      'bg="zzz" is not in acmeTokens',
    ]);
  },
  CHECK_CASE_BOUND,
);

test(
  "with no `./tokens` entry each E1811 form ends `: @acme/ui ships no ./tokens entry` in place of ` is not in acmeTokens`",
  () => {
    const badge = (props: string) =>
      `import { Text } from '@keel/ui'\nexport default function Badge(props: { id: string }) { return <Text id={\`\${props.id}.text\`}${props}>x</Text> }\n`;
    const msgs = (props: string): string[] =>
      codesOf(
        app(
          FIXED,
          [
            { path: PACKAGE_JSON, source: packageJsonNoTokens() },
            { path: `${ROOT}/src/Badge.tsx`, source: badge(props) },
          ],
          [SHIPPED],
        ),
        "E1811",
        composed({}, false),
      ).map((x) => x.message);
    expect(msgs(' look="x"')).toEqual(['look="x": @acme/ui ships no ./tokens entry']);
    expect(msgs(' fg={{ md: "x" }}')).toContain('breakpoint "md": @acme/ui ships no ./tokens entry');
  },
  CHECK_CASE_BOUND,
);

test(
  "a `<value>` over 20 units is clipped to its first 17 units and `...` in an E1811 message, and one of 20 or fewer is whole",
  () => {
    const long = fc.stringMatching(/^[a-z0-9]{21,40}$/);
    const short = fc.stringMatching(/^[a-z0-9]{1,20}$/);
    fc.assert(
      fc.property(long, short, (big, small) => {
        expect(e1811(` p="${big}"`).map((x) => x.message)).toEqual([`p="${big.slice(0, 17)}..." is not in acmeTokens`]);
        expect(e1811(` p="${small}"`).map((x) => x.message)).toEqual([`p="${small}" is not in acmeTokens`]);
      }),
      { seed: SEED, numRuns: 10 },
    );
    const twenty = "abcdefghijklmnopqrst";
    const twentyOne = `${twenty}u`;
    expect(e1811(` p="${twenty}"`).map((x) => x.message)).toEqual([`p="${twenty}" is not in acmeTokens`]);
    expect(e1811(` p="${twentyOne}"`).map((x) => x.message)).toEqual(['p="abcdefghijklmnopq..." is not in acmeTokens']);
  },
  CHECK_CASE_BOUND,
);

// ---- E1812
const shippedWith = (source: string, files: Files = []) =>
  codesOf(app(FIXED, [{ path: SHIPPED, source }, ...files]), "E1812", composed());
const FILE_ERRORS: { name: string; source: string; message: string | RegExp; at: string }[] = [
  {
    name: "a spread",
    source: shippedSource("...other, 'acme.accent': '#0B5CAD', 'acme.ink': '#FFFFFF'"),
    message: "acmeTokens.ts holds a spread; it is one defineTokens literal",
    at: "...other",
  },
  {
    name: "a color key `'accent'`",
    source: shippedSource("'accent': '#0B5CAD', 'acme.ink': '#FFFFFF'"),
    message: 'acmeTokens names color "accent" without acme.',
    at: "'accent'",
  },
  {
    name: "another import",
    source: shippedSource(undefined, "import { x } from './x.ts'\n"),
    message: "acmeTokens.ts holds another import; it is one defineTokens literal",
    at: "import { x }",
  },
  {
    name: "another statement",
    source: `${shippedSource()}const z = 1\n`,
    message: "acmeTokens.ts holds another statement; it is one defineTokens literal",
    at: "const z = 1",
  },
  {
    name: "a computed value",
    source: shippedSource("'acme.accent': accent, 'acme.ink': '#FFFFFF'"),
    message: "acmeTokens.ts holds a computed value; it is one defineTokens literal",
    at: "accent, 'acme.ink'",
  },
  {
    name: "base",
    source: `import { defineTokens } from '@keel/ui/tokens'\nexport const acmeTokens = defineTokens({ base: { page: { bg: 'acme.accent' } }, color: { 'acme.accent': '#0B5CAD', 'acme.ink': '#FFFFFF' } })\n`,
    message: "acmeTokens holds base",
    at: "base:",
  },
  {
    name: "schemes",
    source: `import { defineTokens } from '@keel/ui/tokens'\nexport const acmeTokens = defineTokens({ schemes: ['light'], color: { 'acme.accent': '#0B5CAD', 'acme.ink': '#FFFFFF' } })\n`,
    message: "acmeTokens holds schemes",
    at: "schemes:",
  },
  {
    name: "a look naming a token the object lacks",
    source: `import { defineTokens } from '@keel/ui/tokens'\nexport const acmeTokens = defineTokens({ color: { 'acme.accent': '#0B5CAD', 'acme.ink': '#FFFFFF' }, look: { 'acme.badge': { bg: 'acme.missing', fg: 'acme.ink' } } })\n`,
    message: 'look "acme.badge" names color "acme.missing", not in acmeTokens',
    at: "'acme.badge'",
  },
  {
    name: "a color that fails TokenSchema",
    source: shippedSource("'acme.accent': { light: '#0B5CAD' }, 'acme.ink': '#FFFFFF'"),
    message: /^acmeTokens fails TokenSchema at /,
    at: "'acme.accent'",
  },
];
for (const c of FILE_ERRORS) {
  test(
    `a shipped file holding ${c.name} is one E1812 at the first node out of form${typeof c.message === "string" ? ` with message \`${c.message}\`` : ""}, with no fix`,
    () => {
      const files = app(FIXED, [{ path: SHIPPED, source: c.source }]);
      const d = codesOf(files, "E1812", composed());
      expect(d).toHaveLength(1);
      if (typeof c.message === "string") expect(d[0]?.message).toBe(c.message);
      else expect(d[0]?.message).toMatch(c.message);
      expect(d[0]?.path).toBe(SHIPPED);
      expect(atText(c.source, c.at, d[0]?.line ?? 0, d[0]?.col ?? 0)).toBe(true);
      expect(d[0]?.fix).toBeUndefined();
    },
    CHECK_CASE_BOUND,
  );
}

test(
  "a top-level `base` or `schemes` key in a shipped object is one E1812 `acmeTokens holds base` or `acmeTokens holds schemes`, whatever its value",
  () => {
    const values = fc.constantFrom(
      "{}",
      "'x'",
      "1",
      "['light']",
      "['light', 'dark']",
      "{ page: { bg: 'acme.accent' } }",
      "other",
    );
    fc.assert(
      fc.property(fc.constantFrom("base", "schemes"), values, (key, value) => {
        const source = `import { defineTokens } from '@keel/ui/tokens'\nexport const acmeTokens = defineTokens({ ${key}: ${value}, color: { 'acme.accent': '#0B5CAD', 'acme.ink': '#FFFFFF' } })\n`;
        const d = shippedWith(source);
        expect(d.map((x) => x.message)).toEqual([`acmeTokens holds ${key}`]);
        expect(d[0]?.path).toBe(SHIPPED);
        expect(atText(source, `${key}:`, d[0]?.line ?? 0, d[0]?.col ?? 0)).toBe(true);
        expect(d[0]?.fix).toBeUndefined();
      }),
      { seed: SEED, numRuns: 24 },
    );
  },
  CHECK_CASE_BOUND,
);

test(
  "`src/acmeTokens.ts` given a spread `...other` in `color` is one E1812 at the spread with message `acmeTokens.ts holds a spread; it is one defineTokens literal`, wherever in the group it stands",
  () => {
    fc.assert(
      fc.property(fc.constantFrom(0, 1, 2), (at) => {
        const entries = ["'acme.accent': '#0B5CAD'", "'acme.ink': '#FFFFFF'"];
        entries.splice(at, 0, "...other");
        const source = shippedSource(entries.join(", "));
        const d = shippedWith(source);
        expect(d).toHaveLength(1);
        expect(d[0]?.message).toBe("acmeTokens.ts holds a spread; it is one defineTokens literal");
        expect(atText(source, "...other", d[0]?.line ?? 0, d[0]?.col ?? 0)).toBe(true);
      }),
      { seed: SEED, numRuns: 3 },
    );
  },
  CHECK_CASE_BOUND,
);

test(
  'a `"./tokens"` `keel` target `./src/tokens.ts` is one E1812 at `exports` with message `./tokens keel target is not ./src/acmeTokens.ts`',
  () => {
    const json = packageJson({ keel: "./src/tokens.ts", default: "./index.js" });
    const files = app(FIXED, [{ path: PACKAGE_JSON, source: json }]);
    const d = codesOf(files, "E1812", composed());
    expect(d).toHaveLength(1);
    expect(d[0]?.message).toBe("./tokens keel target is not ./src/acmeTokens.ts");
    expect(d[0]?.path).toBe(PACKAGE_JSON);
    expect(d[0]?.line).toBe(positionOf(json, '"exports"').line);
    expect(d[0]?.fix).toBeUndefined();
  },
  CHECK_CASE_BOUND,
);

test("a shipped file in form is no E1812, and a library listing no `./tokens` entry has none", () => {
  expect(codesOf(app(FIXED), "E1812", composed())).toEqual([]);
  expect(
    codesOf(
      app(FIXED, [{ path: PACKAGE_JSON, source: packageJsonNoTokens() }], [SHIPPED]),
      "E1812",
      composed({}, false),
    ),
  ).toEqual([]);
});

// ---- own folder
const OWN_TOKENS = `import { defineTokens } from "@keel/ui/tokens";\nimport { brandTokens } from "@keel/ui/brand";\nimport { acmeTokens } from "./src/acmeTokens.ts";\n\nexport const tokens = defineTokens({\n  ...brandTokens,\n  color: { ...brandTokens.color, ...acmeTokens.color },\n  look: { ...brandTokens.look, ...acmeTokens.look },\n});\n`;
/** The library's own folder: the library's files at the root, `tokens.ts` composing the shipped object as the fix writes it. */
function own(tokens = OWN_TOKENS, shipped = shippedSource()): Files {
  return [
    { path: "package.json", source: packageJson() },
    { path: "index.js", source: "export {}\n" },
    manifestFile({ id: "acme", deps: [], exports: ["Badge"] }, "."),
    { path: "src/index.ts", source: "export { default as Badge } from './Badge.tsx'\n" },
    { path: "src/Badge.tsx", source: badgeSource() },
    { path: "src/acmeTokens.ts", source: shipped },
    { path: "tokens.ts", source: tokens },
  ];
}
const accent = (hex: string): string => shippedSource(`'acme.accent': '${hex}', 'acme.ink': '#FFFFFF'`);

test(
  'In the library\'s own folder with root `tokens.ts` composing the shipped object as the fix writes it, `keel check` reports one E1804 at the `\'acme.badge\'` key of `src/acmeTokens.ts` with message `look.acme.badge: fg "acme.ink" on bg "acme.accent" is 4.42:1 in light, needs 4.5:1` when `acme.accent` is `#787878`, and none when it is `#0B5CAD`',
  () => {
    const bad = own(OWN_TOKENS, accent("#787878"));
    // The badge's `Text` takes the same pair from its look and is judged as well (k.a11y-static Values, Judged): one more E1804, at `src/Badge.tsx`.
    const all = codesOf(bad, "E1804", composed({ "acme.accent": "#787878" }));
    expect(all.map((x) => x.path).sort()).toEqual(["src/Badge.tsx", "src/acmeTokens.ts"]);
    const d = all.filter((x) => x.path === "src/acmeTokens.ts");
    expect(d).toHaveLength(1);
    expect(d[0]?.message).toBe('look.acme.badge: fg "acme.ink" on bg "acme.accent" is 4.42:1 in light, needs 4.5:1');
    expect(d[0]?.path).toBe("src/acmeTokens.ts");
    expect(atText(sourceOf(bad, "src/acmeTokens.ts"), "'acme.badge'", d[0]?.line ?? 0, d[0]?.col ?? 0)).toBe(true);
    expect(codesOf(own(OWN_TOKENS, accent("#0B5CAD")), "E1804", composed())).toEqual([]);
  },
  CHECK_CASE_BOUND,
);

test(
  "a shipped accent a gray shade under 4.5:1 against white is one E1804 at the `'acme.badge'` key, and any at 4.5:1 or more is none",
  () => {
    const lum = (n: number): number => {
      const c = n / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    fc.assert(
      fc.property(fc.integer({ min: 0x40, max: 0xb0 }), (n) => {
        const ratio = 1.05 / (lum(n) + 0.05);
        fc.pre(Math.abs(ratio - 4.5) > 0.05);
        const hex = `#${n.toString(16).padStart(2, "0").repeat(3)}`;
        const d = codesOf(own(OWN_TOKENS, accent(hex)), "E1804", composed({ "acme.accent": hex }));
        const atKey = d.filter((x) => x.path === "src/acmeTokens.ts");
        expect(atKey.length).toBe(ratio < 4.5 ? 1 : 0);
        expect(d.length - atKey.length).toBe(ratio < 4.5 ? 1 : 0); // the badge's `Text`, judged as well (k.a11y-static Values)
      }),
      { seed: SEED, numRuns: 6 },
    );
  },
  CHECK_CASE_BOUND,
);

test(
  "In that own folder, a fixture key `'acme.accent': '#000000'` after the spread is one E1813 with message `color \"acme.accent\": the fixture overrides acme's default`",
  () => {
    const tokens = OWN_TOKENS.replace("...acmeTokens.color }", "...acmeTokens.color, 'acme.accent': '#000000' }");
    const files = own(tokens);
    const d = codesOf(files, "E1813", composed({ "acme.accent": "#000000" }));
    expect(d).toHaveLength(1);
    expect(d[0]?.message).toBe('color "acme.accent": the fixture overrides acme\'s default');
    expect(d[0]?.path).toBe("tokens.ts");
    expect(d[0]?.fix).toBeUndefined();
    expect(codesOf(own(), "E1813", composed())).toEqual([]);
  },
  CHECK_CASE_BOUND,
);

test(
  "in the own folder a root `tokens.ts` that omits the shipped object is E1810 and the composed one is none",
  () => {
    const brandOnly = `import { brandTokens } from "@keel/ui/brand";\nexport const tokens = brandTokens;\n`;
    expect(codesOf(own(brandOnly), "E1810", brandTokens).length).toBe(1);
    expect(codesOf(own(), "E1810", composed())).toEqual([]);
  },
  CHECK_CASE_BOUND,
);

test(
  "in the own folder a library file naming a token its shipped object lacks is E1811, and one it holds is none",
  () => {
    const bad = own();
    const files = bad.map((f) => (f.path === "src/Badge.tsx" ? { ...f, source: badgeSource(' p="2"') } : f));
    expect(codesOf(files, "E1811", composed()).map((d) => d.message)).toEqual(['p="2" is not in acmeTokens']);
    expect(codesOf(bad, "E1811", composed())).toEqual([]);
  },
  CHECK_CASE_BOUND,
);
