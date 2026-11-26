// Spec: k.looks, clause "In the fixed project, `\"./tokens\":{\"default\":\"./evil.js\",\"keel\":\"./src/acmeTokens.ts\"}` is one E1815 at the `'@acme/ui'` entry with message `@acme/ui exports \"./tokens\" lists keel after another condition`, and `evil.js`, which writes a file when run, writes none during `keel check`; `\"./tokens\":{\"import\":{\"keel\":\"./src/acmeTokens.ts\"}}` and `\".\":{\"node\":\"./index.js\",\"keel\":\"./src/index.ts\"}` are each one E1815."
// Spec: k.looks, clause "In the fixed project with `schemes: ['light', 'dark']` and `'acme.ink': { light: '#FFFFFF', dark: '#FFFFFF' }` shipped against an `acme.accent` of `{ light: '#0B5CAD', dark: '#787878' }`, `keel check` reports one E1804 at the spread `...acmeTokens.color` in `tokens.ts` with message `acme.ink on acme.accent is 4.42:1 in dark, needs 4.5:1; override in tokens.ts` and none under `node_modules/`."
// Spec: k.looks, clause "`src/acmeTokens.ts` with `defineTokens({ ... } as const)` is one E1812 with message `acmeTokens.ts holds a type assertion; it is one defineTokens literal`."
// Spec: k.looks, clause "With `tokens.ts`'s last import line `import { brandTokens } from \"@keel/ui/brand\"; // brand`, E1810's fix leaves that line as it is and adds the import on the line after it."
// Spec: k.looks, clause "E1815 a listed library's `exports` entry holding `keel` other than first (Entries; fix: none)"
// Spec: k.looks, clause "**Library contrast.** In an app, an E1804 at an element of a library file, or at a library look, is reported in `tokens.ts`: at the opening quote of the app's key for its `fg` when the app writes one, else for its `bg`, else at the spread `...<id>Tokens.color`, else line 1, column 1; once per pair and scheme; message `<fg> on <bg> is <ratio>:1 in <scheme>, needs <need>:1; override in tokens.ts`."
// Spec: k.looks, clause "**Entries.** In each listed library's `package.json` `exports`, an entry holding `keel` holds it as its first key and nowhere deeper, else E1815 at each `deps` entry naming the library (`<name> exports \"<key>\" lists keel after another condition`, or `<name> exports \"<key>\" nests keel under another condition` when `keel` sits only deeper)."
// Seed: 1337 (fc.assert below). The half of #12 that needs `keel check` to run (`evil.js` writes a marker file and none is written) is packages/cli/conformance/library-entries-e1815-cli.test.ts, since `check()` evaluates nothing.
// ASSUMPTIONS: see library-looks-support.ts. "At each `deps` entry" is a position on the `'@acme/ui'` literal of `modules/<id>/module.ts`; a nested `keel` reads `@acme/ui exports "<key>" nests keel under another condition` (the spec gives the form `... nests keel under another condition` beside `<name> exports "<key>" lists keel after another condition`). A library-file E1804 in an app is judged over the tokens given as the artifact. In #13 "at the spread" is a position on the `...acmeTokens.color` text. In #14 the position is the line of the assertion. In #15 the fix is applied with `git apply`.
import { defineTokens } from "@keel/ui";
import { brandTokens } from "@keel/ui/brand";
import fc from "fast-check";
import { expect, test } from "vitest";
import { CHECK_CASE_BOUND } from "./check-time.ts";
import { manifestFile } from "./module-support.ts";
import {
  type Files,
  PACKAGE_JSON,
  ROOT,
  SEED,
  SHIPPED,
  app,
  applyFix,
  atText,
  codesOf,
  composed,
  diagnosticsOf,
  fixedTokens,
  shippedSource,
  sourceOf,
} from "./library-looks-support.ts";

const FIXED = fixedTokens();
const MODULE = "modules/shop/module.ts";
const EVIL = "./evil.js";
const SRC = "./src/acmeTokens.ts";
const pkg = (exports: unknown): string =>
  JSON.stringify({ name: "@acme/ui", version: "1.0.0", type: "module", keel: "library", exports }, null, 2);
const entries = (tokens: unknown, dot: unknown = { keel: "./src/index.ts", default: "./index.js" }) =>
  pkg({ ".": dot, "./tokens": tokens });
const e1815 = (json: string, extra: Files = []) =>
  codesOf(app(FIXED, [{ path: PACKAGE_JSON, source: json }, ...extra]), "E1815", composed());

// ---- #12
test(
  'In the fixed project, `"./tokens":{"default":"./evil.js","keel":"./src/acmeTokens.ts"}` is one E1815 at the `\'@acme/ui\'` entry with message `@acme/ui exports "./tokens" lists keel after another condition`',
  () => {
    const files = app(FIXED, [{ path: PACKAGE_JSON, source: entries({ default: EVIL, keel: SRC }) }]);
    const d = codesOf(files, "E1815", composed());
    expect(d).toHaveLength(1);
    expect(d[0]?.message).toBe('@acme/ui exports "./tokens" lists keel after another condition');
    expect(d[0]?.path).toBe(MODULE);
    expect(atText(sourceOf(files, MODULE), "'@acme/ui'", d[0]?.line ?? 0, d[0]?.col ?? 0)).toBe(true);
    expect(d[0]?.fix).toBeUndefined();
  },
  CHECK_CASE_BOUND,
);

test(
  '`"./tokens":{"import":{"keel":"./src/acmeTokens.ts"}}` is one E1815 at the `\'@acme/ui\'` entry, `nests keel under another condition`',
  () => {
    const d = e1815(entries({ import: { keel: SRC } }));
    expect(d).toHaveLength(1);
    expect(d[0]?.message).toBe('@acme/ui exports "./tokens" nests keel under another condition');
    expect(d[0]?.path).toBe(MODULE);
    expect(d[0]?.fix).toBeUndefined();
  },
  CHECK_CASE_BOUND,
);

test(
  '`".":{"node":"./index.js","keel":"./src/index.ts"}` is one E1815 with message `@acme/ui exports "." lists keel after another condition`',
  () => {
    const d = e1815(entries({ keel: SRC, default: "./index.js" }, { node: "./index.js", keel: "./src/index.ts" }));
    expect(d).toHaveLength(1);
    expect(d[0]?.message).toBe('@acme/ui exports "." lists keel after another condition');
  },
  CHECK_CASE_BOUND,
);

test(
  "an entry with `default`, `node` or `import` (or any condition) before `keel` is one E1815, at the top level and in `./tokens`, however many conditions precede it",
  () => {
    const cond = fc.constantFrom("default", "node", "import", "require", "types", "browser", "module");
    fc.assert(
      fc.property(fc.uniqueArray(cond, { minLength: 1, maxLength: 4 }), fc.boolean(), (before, onDot) => {
        const entry = (target: string): Record<string, string> => ({
          ...Object.fromEntries(before.map((c) => [c, EVIL])),
          keel: target,
        });
        const json = onDot
          ? entries({ keel: SRC, default: "./index.js" }, entry("./src/index.ts"))
          : entries(entry(SRC));
        const d = e1815(json);
        expect(d.map((x) => x.message)).toEqual([
          `@acme/ui exports "${onDot ? "." : "./tokens"}" lists keel after another condition`,
        ]);
      }),
      { seed: SEED, numRuns: 24 },
    );
  },
  CHECK_CASE_BOUND,
);

test(
  "`keel` nested under any other condition is one E1815, whatever sits beside it",
  () => {
    const cond = fc.constantFrom("import", "node", "default", "require", "browser");
    fc.assert(
      fc.property(cond, fc.boolean(), (c, sibling) => {
        const inner = sibling ? { keel: SRC, default: EVIL } : { keel: SRC };
        const d = e1815(entries({ [c]: inner }));
        expect(d.map((x) => x.message)).toEqual(['@acme/ui exports "./tokens" nests keel under another condition']);
      }),
      { seed: SEED, numRuns: 10 },
    );
  },
  CHECK_CASE_BOUND,
);

test(
  "an entry holding `keel` first, whatever follows, and an entry with no `keel` are no E1815",
  () => {
    const after = fc.uniqueArray(fc.constantFrom("default", "node", "import", "types"), { maxLength: 4 });
    fc.assert(
      fc.property(after, (rest) => {
        const entry = { keel: SRC, ...Object.fromEntries(rest.map((c) => [c, EVIL])) };
        expect(e1815(entries(entry))).toEqual([]);
      }),
      { seed: SEED, numRuns: 12 },
    );
    expect(e1815(entries({ default: "./index.js" }))).toEqual([]);
  },
  CHECK_CASE_BOUND,
);

test(
  "one E1815 at each `deps` entry naming the library, in every module that lists it",
  () => {
    const files = app(FIXED, [
      { path: PACKAGE_JSON, source: entries({ default: EVIL, keel: SRC }) },
      manifestFile({ id: "shop2", deps: ["@acme/ui"] }),
    ]);
    const d = codesOf(files, "E1815", composed());
    expect(d.map((x) => x.path).sort()).toEqual([MODULE, "modules/shop2/module.ts"]);
  },
  CHECK_CASE_BOUND,
);

test(
  "E1815 is judged with no tokens given, so it does not wait on `tokens.ts` being evaluated",
  () => {
    const files = app(FIXED, [{ path: PACKAGE_JSON, source: entries({ default: EVIL, keel: SRC }) }]);
    expect(diagnosticsOf(files).filter((x) => x.code === "E1815")).toHaveLength(1);
  },
  CHECK_CASE_BOUND,
);

// ---- #13 library contrast
const PAIRS = `import { defineTokens } from "@keel/ui";\nimport { brandTokens } from "@keel/ui/brand";\nimport { acmeTokens } from "@acme/ui/tokens";\n\nexport const tokens = defineTokens({\n  ...brandTokens,\n  schemes: ["light", "dark"],\n  color: { ...brandTokens.color, ...acmeTokens.color%TAIL% },\n  look: { ...brandTokens.look, ...acmeTokens.look },\n});\n`;
const accentDark = (hex: string): Files => [
  {
    path: SHIPPED,
    source: shippedSource(
      `'acme.accent': { light: '#0B5CAD', dark: '${hex}' }, 'acme.ink': { light: '#FFFFFF', dark: '#FFFFFF' }`,
    ),
  },
];
const darkTokens = (accent: { light: string; dark: string }) =>
  defineTokens({
    ...brandTokens,
    schemes: ["light", "dark"],
    color: { ...brandTokens.color, "acme.accent": accent, "acme.ink": { light: "#FFFFFF", dark: "#FFFFFF" } },
    look: { ...brandTokens.look, "acme.badge": { bg: "acme.accent", fg: "acme.ink" } },
  });
const contrast = (files: ReturnType<typeof app>, accent: { light: string; dark: string }) =>
  codesOf(files, "E1804", darkTokens(accent));

test(
  "In the fixed project with `schemes: ['light', 'dark']` and `'acme.ink': { light: '#FFFFFF', dark: '#FFFFFF' }` shipped against an `acme.accent` of `{ light: '#0B5CAD', dark: '#787878' }`, `keel check` reports one E1804 at the spread `...acmeTokens.color` in `tokens.ts` with message `acme.ink on acme.accent is 4.42:1 in dark, needs 4.5:1; override in tokens.ts` and none under `node_modules/`",
  () => {
    const source = PAIRS.replace("%TAIL%", "");
    const files = app(source, accentDark("#787878"));
    const d = contrast(files, { light: "#0B5CAD", dark: "#787878" });
    expect(d).toHaveLength(1);
    expect(d[0]?.message).toBe("acme.ink on acme.accent is 4.42:1 in dark, needs 4.5:1; override in tokens.ts");
    expect(d[0]?.path).toBe("tokens.ts");
    expect(atText(source, "...acmeTokens.color", d[0]?.line ?? 0, d[0]?.col ?? 0)).toBe(true);
    expect(d.filter((x) => x.path.startsWith("node_modules/"))).toEqual([]);
  },
  CHECK_CASE_BOUND,
);

test(
  "with the app writing a key for the pair's `bg` and none for its `fg`, the E1804 is at that key's opening quote in `tokens.ts`, and an override that passes leaves none",
  () => {
    const keyed = PAIRS.replace("%TAIL%", ", 'acme.accent': { light: '#0B5CAD', dark: '#787878' }");
    const d = contrast(app(keyed, accentDark("#787878")), { light: "#0B5CAD", dark: "#787878" });
    expect(d).toHaveLength(1);
    expect(d[0]?.path).toBe("tokens.ts");
    expect(atText(keyed, "'acme.accent'", d[0]?.line ?? 0, d[0]?.col ?? 0)).toBe(true);
    const fixed = PAIRS.replace("%TAIL%", ", 'acme.accent': { light: '#0B5CAD', dark: '#0B5CAD' }");
    expect(contrast(app(fixed, accentDark("#787878")), { light: "#0B5CAD", dark: "#0B5CAD" })).toEqual([]);
  },
  CHECK_CASE_BOUND,
);

test(
  "with the app writing keys for both the pair's `fg` and its `bg`, the E1804 is at the `fg` key's opening quote; with a key for neither, at the spread",
  () => {
    const both = PAIRS.replace(
      "%TAIL%",
      ", 'acme.accent': { light: '#0B5CAD', dark: '#787878' }, 'acme.ink': { light: '#FFFFFF', dark: '#FFFFFF' }",
    );
    const d = contrast(app(both, accentDark("#787878")), { light: "#0B5CAD", dark: "#787878" });
    expect(d).toHaveLength(1);
    expect(d[0]?.path).toBe("tokens.ts");
    expect(atText(both, "'acme.ink'", d[0]?.line ?? 0, d[0]?.col ?? 0)).toBe(true);
    expect(atText(both, "'acme.accent'", d[0]?.line ?? 0, d[0]?.col ?? 0)).toBe(false);
  },
  CHECK_CASE_BOUND,
);

test(
  "a shipped dark accent a gray under 4.5:1 against white is one E1804 in `tokens.ts`, once per pair and scheme however many elements use it, and any at 4.5:1 or more is none, never under `node_modules/`",
  () => {
    const lum = (n: number): number => {
      const c = n / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    fc.assert(
      fc.property(fc.integer({ min: 0x40, max: 0xb0 }), fc.integer({ min: 1, max: 3 }), (n, copies) => {
        const ratio = 1.05 / (lum(n) + 0.05);
        fc.pre(Math.abs(ratio - 4.5) > 0.05);
        const hex = `#${n.toString(16).padStart(2, "0").repeat(3)}`;
        const badge = `import { Box, Text } from '@keel/ui'\nexport default function Badge(props: { id: string }) { return <Box id={\`\${props.id}.box\`}>${Array.from({ length: copies }, (_, i) => `<Text id={\`\${props.id}.t${i}\`} look="acme.badge">x</Text>`).join("")}</Box> }\n`;
        const files = app(PAIRS.replace("%TAIL%", ""), [
          ...accentDark(hex),
          { path: `${ROOT}/src/Badge.tsx`, source: badge },
        ]);
        const d = contrast(files, { light: "#0B5CAD", dark: hex });
        expect(d.length).toBe(ratio < 4.5 ? 1 : 0);
        expect(d.filter((x) => x.path !== "tokens.ts")).toEqual([]);
      }),
      { seed: SEED, numRuns: 8 },
    );
  },
  CHECK_CASE_BOUND,
);

// ---- #14 as const / satisfies
const withArg = (arg: string, tail = ""): string =>
  `import { defineTokens } from '@keel/ui'\nexport const acmeTokens = defineTokens(${arg}${tail})\n`;
const OBJECT = `{ color: { 'acme.accent': '#0B5CAD', 'acme.ink': '#FFFFFF' }, look: { 'acme.badge': { bg: 'acme.accent', fg: 'acme.ink' } } }`;

test(
  "`src/acmeTokens.ts` with `defineTokens({ ... } as const)` is one E1812 with message `acmeTokens.ts holds a type assertion; it is one defineTokens literal`",
  () => {
    const source = withArg(OBJECT, " as const");
    const d = codesOf(app(FIXED, [{ path: SHIPPED, source }]), "E1812", composed());
    expect(d).toHaveLength(1);
    expect(d[0]?.message).toBe("acmeTokens.ts holds a type assertion; it is one defineTokens literal");
    expect(d[0]?.path).toBe(SHIPPED);
    expect(d[0]?.line).toBe(2);
    expect(d[0]?.fix).toBeUndefined();
  },
  CHECK_CASE_BOUND,
);

test(
  "`as` and `satisfies`, on the whole object, on a group or on a value, are each one E1812 `a type assertion`",
  () => {
    const forms = [
      withArg(OBJECT, " satisfies object"),
      withArg(OBJECT, " as unknown as object"),
      withArg(OBJECT.replace("'#0B5CAD'", "'#0B5CAD' as const")),
      withArg(OBJECT.replace("'#FFFFFF'", "'#FFFFFF' satisfies string")),
    ];
    for (const source of forms) {
      const d = codesOf(app(FIXED, [{ path: SHIPPED, source }]), "E1812", composed());
      expect(
        d.map((x) => x.message),
        source,
      ).toEqual(["acmeTokens.ts holds a type assertion; it is one defineTokens literal"]);
    }
  },
  CHECK_CASE_BOUND,
);

// ---- #15 the fix moves no comment
const WITH_COMMENT = (tail: string, head = ""): string =>
  `${head}import { brandTokens } from "@keel/ui/brand";${tail}\nexport const tokens = brandTokens;\n`;
const fixOf = (source: string) => {
  const files = app(source);
  const d = codesOf(files, "E1810", brandTokens);
  expect(d).toHaveLength(1);
  const fix = d[0]?.fix;
  if (fix === undefined) throw new Error("fixture: E1810 carries no fix");
  return applyFix(files, fix);
};

test(
  "With `tokens.ts`'s last import line `import { brandTokens } from \"@keel/ui/brand\"; // brand`, E1810's fix leaves that line as it is and adds the import on the line after it",
  () => {
    const patched = sourceOf(fixOf(WITH_COMMENT(" // brand")), "tokens.ts").split("\n");
    const at = patched.indexOf('import { brandTokens } from "@keel/ui/brand"; // brand');
    expect(at).toBeGreaterThanOrEqual(0);
    const imports = patched.slice(at + 1).filter((l) => l.startsWith("import "));
    expect(imports).toContain('import { acmeTokens } from "@acme/ui/tokens";');
    expect(patched.filter((l) => l.includes("// brand"))).toHaveLength(1);
  },
  CHECK_CASE_BOUND,
);

test(
  "with `defineTokens` already imported above it, the new import is the very next line after the last import line, which keeps its trailing comment",
  () => {
    const head = 'import { defineTokens } from "@keel/ui";\n';
    const source = `${head}import { brandTokens } from "@keel/ui/brand"; // brand\nexport const tokens = defineTokens({ ...brandTokens });\n`;
    const patched = sourceOf(fixOf(source), "tokens.ts").split("\n");
    const at = patched.indexOf('import { brandTokens } from "@keel/ui/brand"; // brand');
    expect(at).toBeGreaterThanOrEqual(0);
    expect(patched[at + 1]).toBe('import { acmeTokens } from "@acme/ui/tokens";');
  },
  CHECK_CASE_BOUND,
);

test(
  "whatever trailing line or block comment the last import carries, the fix keeps that line whole",
  () => {
    const text = fc.stringMatching(/^[a-z][a-z ]{0,10}$/);
    fc.assert(
      fc.property(text, fc.boolean(), (t, block) => {
        const line = `import { brandTokens } from "@keel/ui/brand";${block ? ` /* ${t} */` : ` // ${t}`}`;
        const patched = sourceOf(
          fixOf(WITH_COMMENT(line.slice('import { brandTokens } from "@keel/ui/brand";'.length))),
          "tokens.ts",
        ).split("\n");
        expect(patched).toContain(line);
        const at = patched.indexOf(line);
        expect(patched.slice(at + 1).some((l) => l === 'import { acmeTokens } from "@acme/ui/tokens";')).toBe(true);
      }),
      { seed: SEED, numRuns: 6 },
    );
  },
  CHECK_CASE_BOUND,
);
