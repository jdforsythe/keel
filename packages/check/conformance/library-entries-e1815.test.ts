// Shape: "**Shape.** A listed library's `package.json` `exports` is an object, and each entry is an object whose first key is `keel` and whose `keel` value is a string naming a file under `src/` or `unsafe/` (`./tools` included, whose other conditions Node reads). Anything else is E1815 at each `deps` entry naming the library: an `exports` that is a string or an array (`<name> exports is no object`); an entry that is a string, an array or `null` (`<name> exports \"<key>\" is no object with keel first`); `keel` after another key (`<name> exports \"<key>\" lists keel after another condition`) or only deeper (`<name> exports \"<key>\" nests keel under another condition`); a `keel` value that is no string or names no such file (`<name> exports \"<key>\" keel names no file`); a key with `*` that matches a subpath a file check reads imports from the library (`<name> exports \"<key>\" matches \"<subpath>\"; give it an entry`), unless an entry of its own names that subpath, which Node prefers and which is judged instead. E1815 is judged from `package.json`'s text before anything of the project is evaluated or bundled, and while one stands no file of that library is evaluated or bundled and `tokens.ts` is not evaluated, so the file check reads is the one every surface loads."
// Rules: "**Rules.** E1815 a listed library's `exports` out of shape (Shape; fix: none). A diagnostic at a `deps` entry lies on it, from its opening quote to its closing one."
// Spec: k.entries, clause "`\"./tokens\":{\"default\":\"./evil.js\",\"keel\":\"./src/acmeTokens.ts\"}` is one E1815 at the `'@acme/ui'` entry with message `@acme/ui exports \"./tokens\" lists keel after another condition`, and `evil.js`, which writes a file when run, writes none during `keel check`; `\"./tokens\":{\"import\":{\"keel\":\"./src/acmeTokens.ts\"}}` and `\".\":{\"node\":\"./index.js\",\"keel\":\"./src/index.ts\"}` are each one E1815."
// Spec: k.entries, clause "Each of `\"./tokens\":[\"./evil.js\",{\"keel\":\"./src/acmeTokens.ts\"}]`, `\"./tokens\":\"./evil.js\"`, `\"./tokens\":null`, `\"./tokens\":{\"keel\":{\"default\":\"./evil.js\"}}`, `\"./tokens\":{\"keel\":\"./lib/t.ts\"}` and `exports` `\"./evil.js\"` is one E1815 at the `'@acme/ui'` entry, and `evil.js` writes no file during `keel check` or `keel build`."
// Spec: k.entries, clause "With no `./tokens` entry and `\"./*\":{\"keel\":\"./src/*.ts\",\"default\":\"./evil.js\"}`, `tokens.ts`'s import of `@acme/ui/tokens` is one E1815 with message `@acme/ui exports \"./*\" matches \"./tokens\"; give it an entry`, and `evil.js` writes no file during `keel check` or `keel build`."
// Library contrast (k.a11y-static): "**Library contrast.** In an app, an E1804 at an element of a library file, or at a library look (a key of the `look` group alone, whatever other groups hold the same name), is reported in `tokens.ts` and not at the library's file: at the opening quote of the app's key for its `fg` when the app writes one, else for its `bg`, else at the spread `...<id>Tokens.color`, else line 1, column 1; once per pair and scheme however many elements and looks hold it; message `<fg> on <bg> is <ratio>:1 in <scheme>, needs <need>:1; override in tokens.ts`."
// Spec: k.a11y-static, clause "In k.looks' fixed project with `schemes: ['light', 'dark']` and `'acme.ink': { light: '#FFFFFF', dark: '#FFFFFF' }` shipped against an `acme.accent` of `{ light: '#0B5CAD', dark: '#787878' }`, `keel check` reports one E1804 at the spread `...acmeTokens.color` in `tokens.ts` with message `acme.ink on acme.accent is 4.42:1 in dark, needs 4.5:1; override in tokens.ts` and none under `node_modules/`, and one, not two, when the app's tokens also hold a `radius` token `acme.badge`."
// Spec: k.looks, clause "`src/acmeTokens.ts` with `defineTokens({ ... } as const)` is one E1812 with message `acmeTokens.ts holds a type assertion; it is one defineTokens literal`."
// Spec: k.looks, clause "With `tokens.ts`'s last import line `import { brandTokens } from \"@keel/ui/brand\"; // brand`, E1810's fix leaves that line as it is and adds the import on the line after it; with `/* a` ending that line and ` b */` on the next, it adds the import after the line holding ` b */`."
// Fix (k.looks): "**Fix.** E1810's fix applies when `tokens` is `defineTokens(<object literal>)`, or an imported name `S`, taken as `defineTokens({ ...S })` with `defineTokens` imported from `@keel/ui` when the file does not import it. It adds `import { <id>Tokens } from \"<name>/tokens\";` after the last import, and for each group the shipped object holds, in k.ui's order with `look` last: `...<id>Tokens.<group>` after the last spread of the literal's `<group>` object, or, when the literal has no `<group>` property, `<group>: { ...S.<group>, ...<id>Tokens.<group> }` at its end, with one `...S.<group>` per top-level spread `...S` of an imported name whose tokens hold that group, in order. A `<group>` written as anything but an object literal gets no fix. The fix moves no comment: the import goes on its own line after the line on which the last import statement ends, or, when a comment that begins on that line ends on a later one, after the line that comment ends on. The fix's layout is not judged: a test compares the fixed file with the expected one after formatting both with `biome format` under the repo's configuration."
// Seed: 1337 (fc.assert below). The half that needs `keel check`, `keel build` and `keel dev` to run (`evil.js` writes a marker file and none is written) is packages/cli/conformance/library-entries-e1815-cli.test.ts, since `check()` evaluates nothing.
// ASSUMPTIONS: see library-looks-support.ts. "At each `deps` entry" is a position on the `'@acme/ui'` literal of `modules/<id>/module.ts`. In the library-contrast cases "at the spread" is a position on the `...acmeTokens.color` text. In the E1812 case the position is the line of the assertion. The E1810 fix is applied with `git apply`.
// "keel names no file" is read as the spec lists it: a `keel` value that is no string, or a string naming no file under `src/` or `unsafe/` of the library (a file outside both, `./lib/t.ts`, and a missing `./src/missing.ts`, are each one).
import { defineTokens } from "@keel/ui";
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
  applyFix,
  atText,
  codesOf,
  composed,
  diagnosticsOf,
  fixedTokens,
  shippedSource,
  sourceOf,
} from "./library-looks-support.ts";
import { manifestFile } from "./module-support.ts";

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

// ---- k.entries Shape: every refused shape at every entry key
const KEYS = [".", "./tokens", "./contract", "./routes", "./tools"] as const;
const LIB_FILES: Files = [
  { path: `${ROOT}/lib/t.ts`, source: "export const t = 1\n" },
  { path: `${ROOT}/unsafe/tools.ts`, source: "export const tools = 1\n" },
  { path: `${ROOT}/src/contract.ts`, source: "export const c = 1\n" },
];
const VALID: Record<string, unknown> = {
  ".": { keel: "./src/index.ts", default: "./index.js" },
  "./tokens": { keel: SRC, default: "./index.js" },
};
/** The library's `package.json` with entry `key` holding `entry` and the fixture's other entries as they are. */
const withEntry = (key: string, entry: unknown): string => pkg({ ...VALID, [key]: entry });
const noObject = (key: string): string => `@acme/ui exports "${key}" is no object with keel first`;
const after = (key: string): string => `@acme/ui exports "${key}" lists keel after another condition`;
const nests = (key: string): string => `@acme/ui exports "${key}" nests keel under another condition`;
const noFile = (key: string): string => `@acme/ui exports "${key}" keel names no file`;
const SHAPES: { label: string; entry: unknown; message: (key: string) => string }[] = [
  { label: '`"./evil.js"` (a string)', entry: EVIL, message: noObject },
  { label: '`["./evil.js", { keel }]` (an array)', entry: [EVIL, { keel: SRC }], message: noObject },
  { label: "`null`", entry: null, message: noObject },
  { label: "`{ default, keel }` (keel after another condition)", entry: { default: EVIL, keel: SRC }, message: after },
  { label: "`{ import: { keel } }` (keel nested)", entry: { import: { keel: SRC } }, message: nests },
  { label: "`{ keel: { default } }` (keel is no string)", entry: { keel: { default: EVIL } }, message: noFile },
  { label: "`{ keel: 5 }` (keel is no string)", entry: { keel: 5 }, message: noFile },
  { label: "`{ keel: null }`", entry: { keel: null }, message: noFile },
  {
    label: '`{ keel: "./lib/t.ts" }` (a file outside src/ and unsafe/)',
    entry: { keel: "./lib/t.ts" },
    message: noFile,
  },
  {
    label: '`{ keel: "./src/missing.ts" }` (a file that does not exist)',
    entry: { keel: "./src/missing.ts" },
    message: noFile,
  },
];
for (const key of KEYS) {
  for (const shape of SHAPES) {
    test(
      `with ${shape.label} at \`"${key}"\`, there is one E1815 at the \`'@acme/ui'\` entry with message \`${shape.message(key)}\`, and no fix`,
      () => {
        const files = app(FIXED, [{ path: PACKAGE_JSON, source: withEntry(key, shape.entry) }, ...LIB_FILES]);
        const d = codesOf(files, "E1815", composed());
        expect(d.map((x) => x.message)).toEqual([shape.message(key)]);
        expect(d[0]?.path).toBe(MODULE);
        expect(atText(sourceOf(files, MODULE), "'@acme/ui'", d[0]?.line ?? 0, d[0]?.col ?? 0)).toBe(true);
        expect(d[0]?.fix).toBeUndefined();
      },
      CHECK_CASE_BOUND,
    );
  }
}

test(
  "an `exports` that is a string (`\"./evil.js\"`) or an array is one E1815 with message `@acme/ui exports is no object` at the `'@acme/ui'` entry",
  () => {
    for (const exports of [EVIL, [EVIL], [{ keel: "./src/index.ts" }], []]) {
      const d = e1815(pkg(exports), LIB_FILES);
      expect(
        d.map((x) => x.message),
        JSON.stringify(exports),
      ).toEqual(["@acme/ui exports is no object"]);
      expect(d[0]?.path).toBe(MODULE);
      expect(d[0]?.fix).toBeUndefined();
    }
  },
  CHECK_CASE_BOUND,
);

test(
  "an entry holding `keel` first and naming a file under `src/` or `unsafe/`, whatever follows and whichever key holds it, is no E1815",
  () => {
    const entries: [string, unknown][] = [
      ["./contract", { keel: "./src/contract.ts", default: "./index.js" }],
      ["./routes", { keel: "./src/contract.ts", node: "./index.js", default: "./index.js" }],
      ["./tools", { keel: "./unsafe/tools.ts", node: "./index.js", default: "./index.js" }],
      ["./tools", { keel: "./src/contract.ts" }],
    ];
    for (const [key, entry] of entries) {
      expect(e1815(withEntry(key, entry), LIB_FILES), `${key} ${JSON.stringify(entry)}`).toEqual([]);
    }
  },
  CHECK_CASE_BOUND,
);

test(
  "a refused shape in any of several entries is one E1815 for the first, and each `deps` entry naming the library holds it, in every module that lists it",
  () => {
    const json = pkg({ ...VALID, "./contract": EVIL, "./routes": { default: EVIL, keel: "./src/contract.ts" } });
    const files = app(FIXED, [
      { path: PACKAGE_JSON, source: json },
      ...LIB_FILES,
      manifestFile({ id: "shop2", deps: ["@acme/ui"] }),
    ]);
    const d = codesOf(files, "E1815", composed());
    expect(d.length).toBeGreaterThanOrEqual(2);
    expect(new Set(d.map((x) => x.path))).toEqual(new Set([MODULE, "modules/shop2/module.ts"]));
    for (const x of d) expect(x.message).toMatch(/^@acme\/ui exports "\.\/(contract|routes)" /);
  },
  CHECK_CASE_BOUND,
);

// ---- a `*` key
const WILD = { "./*": { keel: "./src/*.ts", default: EVIL } };
test(
  'with no `./tokens` entry and `"./*":{"keel":"./src/*.ts","default":"./evil.js"}`, `tokens.ts`\'s import of `@acme/ui/tokens` is one E1815 with message `@acme/ui exports "./*" matches "./tokens"; give it an entry`',
  () => {
    const json = pkg({ ".": VALID["."], ...WILD });
    const files = app(FIXED, [{ path: PACKAGE_JSON, source: json }]);
    const d = codesOf(files, "E1815", composed());
    expect(d.map((x) => x.message)).toEqual(['@acme/ui exports "./*" matches "./tokens"; give it an entry']);
    expect(d[0]?.path).toBe(MODULE);
    expect(d[0]?.fix).toBeUndefined();
  },
  CHECK_CASE_BOUND,
);

test(
  "a `*` key beside an entry of its own for the imported subpath `./tokens` is no E1815 for the `*` key: Node prefers the entry, which is judged instead",
  () => {
    const wild = (tokens: unknown): string => pkg({ ".": VALID["."], ...WILD, "./tokens": tokens });
    expect(e1815(wild({ keel: SRC, default: EVIL }))).toEqual([]);
    const d = e1815(wild({ default: EVIL, keel: SRC }));
    expect(d.map((x) => x.message)).toEqual(['@acme/ui exports "./tokens" lists keel after another condition']);
    expect(e1815(wild(EVIL)).map((x) => x.message)).toEqual([
      '@acme/ui exports "./tokens" is no object with keel first',
    ]);
  },
  CHECK_CASE_BOUND,
);

test(
  "a `*` key that matches no subpath a file check reads imports from the library is no E1815, and one that matches is, whatever condition follows `keel`",
  () => {
    const json = (key: string, entry: unknown): string => pkg({ ".": VALID["."], [key]: entry });
    for (const key of ["./icons/*", "./x-*", "./deep/*/file"]) {
      expect(e1815(json(key, { keel: "./src/*.ts" })), key).toEqual([]);
    }
    for (const key of ["./*", "./tok*", "./*ens"]) {
      const d = e1815(json(key, { keel: "./src/*.ts", default: EVIL }));
      expect(
        d.map((x) => x.message),
        key,
      ).toEqual([`@acme/ui exports "${key}" matches "./tokens"; give it an entry`]);
    }
  },
  CHECK_CASE_BOUND,
);

test(
  "a shape out of form in any entry is one E1815, generated over keys and shapes, and an entry in form is none",
  () => {
    const keys = fc.constantFrom(...KEYS);
    const shape = fc.constantFrom(...SHAPES);
    fc.assert(
      fc.property(keys, shape, (key, s) => {
        const d = e1815(withEntry(key, s.entry), LIB_FILES);
        expect(d.map((x) => x.message)).toEqual([s.message(key)]);
      }),
      { seed: SEED, numRuns: 12 },
    );
  },
  CHECK_CASE_BOUND,
);

// ---- k.a11y-static Library contrast: a look found by `look` keys only
test(
  "one E1804 at the spread `...acmeTokens.color`, not two, when the app's tokens also hold a `radius` token `acme.badge` named like the library's look",
  () => {
    const source = PAIRS.replace("%TAIL%", "");
    const files = app(source, accentDark("#787878"));
    const tokens = defineTokens({
      ...brandTokens,
      schemes: ["light", "dark"],
      color: {
        ...brandTokens.color,
        "acme.accent": { light: "#0B5CAD", dark: "#787878" },
        "acme.ink": { light: "#FFFFFF", dark: "#FFFFFF" },
      },
      radius: { ...brandTokens.radius, "acme.badge": "4px" },
      look: { ...brandTokens.look, "acme.badge": { bg: "acme.accent", fg: "acme.ink" } },
    });
    const d = codesOf(files, "E1804", tokens);
    expect(d).toHaveLength(1);
    expect(d[0]?.message).toBe("acme.ink on acme.accent is 4.42:1 in dark, needs 4.5:1; override in tokens.ts");
    expect(d[0]?.path).toBe("tokens.ts");
    expect(atText(source, "...acmeTokens.color", d[0]?.line ?? 0, d[0]?.col ?? 0)).toBe(true);
  },
  CHECK_CASE_BOUND,
);

test(
  "a name held only by a group other than `look` (a `radius` or `space` token `acme.badge`, no look of that name) is no library look: a `Text` naming it by `look` is judged as the element it is",
  () => {
    const source = PAIRS.replace("%TAIL%", "").replace("  look: { ...brandTokens.look, ...acmeTokens.look },\n", "");
    const tokens = defineTokens({
      ...brandTokens,
      schemes: ["light", "dark"],
      color: {
        ...brandTokens.color,
        "acme.accent": { light: "#0B5CAD", dark: "#787878" },
        "acme.ink": { light: "#FFFFFF", dark: "#FFFFFF" },
      },
      radius: { ...brandTokens.radius, "acme.badge": "4px" },
    });
    const d = codesOf(app(source, accentDark("#787878")), "E1804", tokens);
    expect(d.filter((x) => x.path !== "tokens.ts")).toEqual([]);
    expect(d.length).toBeLessThanOrEqual(1);
  },
  CHECK_CASE_BOUND,
);

// ---- E1810's fix after a multi-line comment
const MULTI = (lines: string[]): string =>
  `import { brandTokens } from "@keel/ui/brand"; /* ${lines.join("\n")} */\nexport const tokens = brandTokens;\n`;
test(
  "with `/* a` ending the last import line and ` b */` on the next, E1810's fix adds the import on the line after the line holding ` b */`, and moves no comment line",
  () => {
    const source = `import { brandTokens } from "@keel/ui/brand"; /* a\n b */\nexport const tokens = brandTokens;\n`;
    const patched = sourceOf(fixOf(source), "tokens.ts").split("\n");
    const open = patched.indexOf('import { brandTokens } from "@keel/ui/brand"; /* a');
    expect(open).toBeGreaterThanOrEqual(0);
    expect(patched[open + 1]).toBe(" b */");
    expect(patched[open + 2]).toBe('import { acmeTokens } from "@acme/ui/tokens";');
  },
  CHECK_CASE_BOUND,
);

test(
  "whatever the number of lines a comment that begins on the last import's line spans, the fix goes after the line it ends on and the comment's lines stay together",
  () => {
    const word = fc.stringMatching(/^[a-z]{1,6}$/);
    fc.assert(
      fc.property(fc.array(word, { minLength: 2, maxLength: 5 }), (words) => {
        const [first = "a", ...rest] = words;
        const source = MULTI([first, ...rest]);
        const patched = sourceOf(fixOf(source), "tokens.ts").split("\n");
        const open = patched.indexOf(`import { brandTokens } from "@keel/ui/brand"; /* ${first}`);
        expect(open).toBeGreaterThanOrEqual(0);
        for (let i = 0; i < rest.length; i++) {
          expect(patched[open + 1 + i]).toBe(i === rest.length - 1 ? `${rest[i]} */` : rest[i]);
        }
        expect(patched[open + 1 + rest.length]).toBe('import { acmeTokens } from "@acme/ui/tokens";');
      }),
      { seed: SEED, numRuns: 6 },
    );
  },
  CHECK_CASE_BOUND,
);

test(
  "a last import statement that spans lines gets the new import after the line it ends on, and a comment that begins and ends on an earlier line moves nothing",
  () => {
    const source = `/* top\n note */\nimport {\n  brandTokens,\n} from "@keel/ui/brand";\nexport const tokens = brandTokens;\n`;
    const patched = sourceOf(fixOf(source), "tokens.ts").split("\n");
    const end = patched.indexOf('} from "@keel/ui/brand";');
    expect(end).toBeGreaterThanOrEqual(0);
    expect(patched[end + 1]).toBe('import { acmeTokens } from "@acme/ui/tokens";');
    expect(patched.slice(0, 2)).toEqual(["/* top", " note */"]);
  },
  CHECK_CASE_BOUND,
);
