// Seed 1337
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { localeFormatter } from "../src/tools/localeFormatter.ts";

const SEED = 1337;
type Files = Parameters<typeof check>[0];
const DEP = "'@keel/std-i18n'";
const BAD = "export const f = new Intl.NumberFormat('de-DE')\n";
const run = (fs: Files) => check(fs, { types: false }).diagnostics.filter((d) => d.code === "E2301");
/** Findings for `code` in `modules/a/x.ts` under the manifest `manifestSource`. */
const under = (manifestSource: string, code = BAD) =>
  run([
    { path: "modules/a/module.ts", source: manifestSource },
    { path: "modules/a/x.ts", source: code },
  ]);
const withDeps = (code: string) => under(`export default { id: 'a', deps: [${DEP}] }\n`, code);
const messages = (code: string) => withDeps(code).map((d) => d.message);

test("the rule is E2301 of std.i18n and its explanation points at the stdlib formatters", () => {
  expect(localeFormatter.code).toBe("E2301");
  expect(localeFormatter.see).toBe("std.i18n");
  expect(localeFormatter.explain).toContain("formatNumber(n, locale)");
  expect(localeFormatter.explain).toContain("new Intl.NumberFormat(locale)");
});

test("the message names the construct and the stdlib function, for each Intl formatter", () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    ["new Intl.Collator('de-DE')", "Intl.Collator with a locale; use compareText"],
    ["new Intl.DateTimeFormat('de-DE')", "Intl.DateTimeFormat with a locale; use formatDate or formatInstant"],
    ["new Intl.DisplayNames('de-DE', { type: 'region' })", "Intl.DisplayNames with a locale; use localeName"],
    ["new Intl.DurationFormat('de-DE')", "Intl.DurationFormat with a locale; use formatDuration"],
    ["new Intl.NumberFormat('de-DE')", "Intl.NumberFormat with a locale; use formatNumber"],
    ["new Intl.PluralRules('de-DE')", "Intl.PluralRules with a locale; use plural"],
    ["new Intl.RelativeTimeFormat('de-DE')", "Intl.RelativeTimeFormat with a locale; use formatDuration"],
    ["Intl.Collator('de-DE')", "Intl.Collator with a locale; use compareText"],
  ];
  for (const [code, message] of cases) expect(messages(`export const f = ${code}\n`), code).toEqual([message]);
});

test("the message names the method and the stdlib function, for each locale-taking method", () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    ["a.localeCompare(b, 'de-DE')", "localeCompare with a locale; use compareText"],
    ["a.toLocaleDateString('de-DE')", "toLocaleDateString with a locale; use formatDate"],
    ["a.toLocaleString('de-DE')", "toLocaleString with a locale; use formatNumber, formatMoney or formatInstant"],
    ["a.toLocaleTimeString('de-DE')", "toLocaleTimeString with a locale; use formatInstant"],
  ];
  for (const [code, message] of cases)
    expect(messages(`export const f = (a, b) => ${code}\n`), code).toEqual([message]);
});

test("a NumberFormat with the currency style points at formatMoney and any other style at formatNumber", () => {
  const nf = (opts: string) => messages(`export const f = new Intl.NumberFormat('de-DE', ${opts})\n`);
  const money = ["Intl.NumberFormat with a locale; use formatMoney"];
  const number = ["Intl.NumberFormat with a locale; use formatNumber"];
  expect(nf("{ style: 'currency', currency: 'EUR' }")).toEqual(money);
  expect(nf("{ currency: 'EUR', style: 'currency' }")).toEqual(money);
  expect(nf("{ ...base, style: 'currency' }")).toEqual(money);
  expect(nf("{ style: 'percent' }")).toEqual(number);
  expect(nf("{ currency: 'currency' }")).toEqual(number);
  expect(nf("{ style: currency }")).toEqual(number);
  expect(nf("{ ['style']: 'currency' }")).toEqual(number);
  expect(nf("{ 'style': 'currency' }")).toEqual(number);
  expect(nf("{ style }")).toEqual(number);
  expect(nf("{ style() { return 'currency' } }")).toEqual(number);
  expect(nf("{ get style() { return 'currency' } }")).toEqual(number);
  expect(nf("options")).toEqual(number);
  expect(nf("{}")).toEqual(number);
  expect(nf("['currency']")).toEqual(number);
  const other = messages("export const f = new Intl.DateTimeFormat('de-DE', { style: 'currency' })\n");
  expect(other).toEqual(["Intl.DateTimeFormat with a locale; use formatDate or formatInstant"]);
  expect(messages("export const f = new Intl.PluralRules('de-DE', { style: 'currency' })\n")).toEqual([
    "Intl.PluralRules with a locale; use plural",
  ]);
});

test("an absent locale, or the identifier undefined, asks for the host locale and is not reported", () => {
  const code = [
    "export const a = new Intl.NumberFormat()",
    "export const b = new Intl.NumberFormat(undefined, { style: 'currency' })",
    "export const c = (n) => n.toLocaleString(undefined, { maximumFractionDigits: 0 })",
    "export const d = (n) => n.toLocaleDateString(undefined)",
    "export const e = (n) => n.toLocaleTimeString()",
    "export const f = (a, b) => a.localeCompare(b, undefined)",
    "export const g = (a, b) => a.localeCompare(b)",
    "",
  ].join("\n");
  expect(withDeps(code)).toEqual([]);
});

test("a locale given as a variable, a call or void 0 is a locale", () => {
  const code = [
    "export const a = (l) => new Intl.NumberFormat(l)",
    "export const b = (n, l) => n.toLocaleString(l)",
    "export const c = (n) => n.toLocaleString(getLocale())",
    "export const d = (n) => n.toLocaleDateString(void 0)",
    "export const e = (a, b, l) => a.localeCompare(b, l)",
    "export const f = (n) => n.toLocaleString(`de-DE`)",
    "",
  ].join("\n");
  expect(withDeps(code).map((d) => d.line)).toEqual([1, 2, 3, 4, 5, 6]);
});

test("the locale of localeCompare is its second argument and that of the others its first", () => {
  expect(withDeps("export const a = (x, y) => x.localeCompare('de-DE')\n")).toEqual([]);
  expect(withDeps("export const a = (x, y) => x.localeCompare(y, 'de-DE')\n").length).toBe(1);
  expect(withDeps("export const a = (x) => x.toLocaleString(undefined, 'de-DE')\n")).toEqual([]);
  expect(withDeps("export const a = (x) => x.toLocaleString('de-DE', undefined)\n").length).toBe(1);
});

test("only the Intl namespace's own formatters and plain member calls are reported", () => {
  const code = [
    "export const a = new Intl.Segmenter('de-DE')",
    "export const b = new Intl.ListFormat('de-DE')",
    "export const c = new Other.NumberFormat('de-DE')",
    "export const d = new foo.Intl.NumberFormat('de-DE')",
    "export const e = new Intl['NumberFormat']('de-DE')",
    "export const f = Intl.NumberFormat.supportedLocalesOf('de-DE')",
    "export const g = new NumberFormat('de-DE')",
    "export const h = (x) => x['toLocaleString']('de-DE')",
    "export const i = (x) => x.toLocaleUpperCase('de-DE')",
    "export const j = (x) => toLocaleString('de-DE')",
    "export const k = (x) => x.format('de-DE')",
    "export const l = (x) => new x.toLocaleString('de-DE')",
    "export const m = (x) => Intl[x]('de-DE')",
    "export const n = new (Intl.NumberFormat)('de-DE')",
    "",
  ].join("\n");
  expect(withDeps(code).map((d) => d.line)).toEqual([]);
});

test("a construct nested in other code is found, with its line and column, in source order", () => {
  const code = [
    "export const a = list.map((n) =>",
    "  n.toLocaleString('de-DE'))",
    "const z = 1; export const b = wrap(new Intl.Collator('de-DE'), (x, y) => x.localeCompare(y, 'de-DE'))",
    "",
  ].join("\n");
  expect(withDeps(code).map((d) => [d.line, d.col, d.path])).toEqual([
    [2, 3, "modules/a/x.ts"],
    [3, 36, "modules/a/x.ts"],
    [3, 74, "modules/a/x.ts"],
  ]);
});

test("a finding on the first column of the first line is at line 1, column 1", () => {
  expect(withDeps("new Intl.NumberFormat('de-DE')\n").map((d) => [d.line, d.col])).toEqual([[1, 1]]);
});

test("every finding of generated calls is reported once at its own line, with no fix", () => {
  const call = fc.constantFrom(
    ["new Intl.NumberFormat('de-DE')", "formatNumber"],
    ["new Intl.Collator('de-DE')", "compareText"],
    ["x.toLocaleDateString('de-DE')", "formatDate"],
    ["x.toLocaleTimeString('de-DE')", "formatInstant"],
  );
  fc.assert(
    fc.property(fc.array(call, { minLength: 1, maxLength: 6 }), (cs) => {
      const code = cs.map(([c], i) => `export const v${i} = (x) => ${c}`).join("\n");
      const found = withDeps(`${code}\n`);
      expect(found.map((d) => d.line)).toEqual(cs.map((_, i) => i + 1));
      cs.forEach(([, use], i) => expect(found[i]?.message.endsWith(`use ${use}`)).toBe(true));
      expect(found.every((d) => d.fix === undefined)).toBe(true);
    }),
    { seed: SEED, numRuns: 40 },
  );
});

test("a module is the module.ts with the longest directory prefix of the file", () => {
  const fs: Files = [
    { path: "modules/a/module.ts", source: `export default { id: 'a', deps: [${DEP}] }\n` },
    { path: "modules/a/deep/module.ts", source: "export default { id: 'deep', deps: [] }\n" },
    { path: "modules/a/deep/er/module.ts", source: `export default { id: 'er', deps: [${DEP}] }\n` },
    { path: "modules/a/x.ts", source: BAD },
    { path: "modules/a/sub/x.ts", source: BAD },
    { path: "modules/a/deep/x.ts", source: BAD },
    { path: "modules/a/deep/more/x.ts", source: BAD },
    { path: "modules/a/deep/er/x.ts", source: BAD },
    { path: "modules/ab/x.ts", source: BAD },
    { path: "other/x.ts", source: BAD },
  ];
  expect(run(fs).map((d) => d.path)).toEqual(["modules/a/deep/er/x.ts", "modules/a/sub/x.ts", "modules/a/x.ts"]);
});

test("a manifest at the project root is the module of every file without a nearer one", () => {
  const fs: Files = [
    { path: "module.ts", source: `export default { id: 'root', deps: [${DEP}] }\n` },
    { path: "x.ts", source: BAD },
    { path: "lib/y.ts", source: BAD },
    { path: "lib/module.ts", source: "export default { id: 'lib', deps: [] }\n" },
    { path: "lib/z.ts", source: BAD },
  ];
  expect(run(fs).map((d) => d.path)).toEqual(["x.ts"]);
});

test("only a file named exactly module.ts is a manifest", () => {
  const fs: Files = [
    { path: "modules/a/notmodule.ts", source: `export default { id: 'a', deps: [${DEP}] }\n` },
    { path: "modules/a/module.tsx", source: `export default { id: 'a', deps: [${DEP}] }\n` },
    { path: "modules/a/x.ts", source: BAD },
  ];
  expect(run(fs)).toEqual([]);
  expect(run([{ path: "x.ts", source: BAD }]), "a file outside every module depends on nothing").toEqual([]);
});

test("a manifest lists std-i18n in the deps of a default-exported object, call, cast or parenthesised object", () => {
  const listed: readonly string[] = [
    `export default { id: 'a', deps: [${DEP}] }`,
    `export default { 'deps': [${DEP}] }`,
    `export default { id: 'a', deps: [${DEP}], other: 1 }`,
    `export default { id: 'a', deps: ['@keel/x', ${DEP}] }`,
    `export default { ...base, deps: [${DEP}] }`,
    `export default { deps: [...more, ${DEP}] }`,
    `export default { deps: [, ${DEP}] }`,
    `export default { deps: [1, null, ${DEP}] }`,
    `export default { deps: [${DEP}] } as const`,
    `export default { deps: [${DEP}] } satisfies Manifest`,
    `export default ({ deps: [${DEP}] })`,
    `export default (({ deps: [${DEP}] }) as const)`,
    `export default { deps: [${DEP}] as const }`,
    `export default { deps: ([${DEP}]) }`,
    `export default module({ id: 'a', deps: [${DEP}] })`,
    `export default module(({ deps: [${DEP}] }) as const)`,
    `export default module({ deps: [${DEP}] }, extra)`,
    `export const before = 1\nexport default { deps: [${DEP}] }`,
    `import { module } from '@keel/kernel'\nexport default module({ deps: [${DEP}] })`,
  ];
  for (const m of listed) expect(under(`${m}\n`).length, m).toBe(1);
});

test("a manifest that lists no std-i18n in a static deps array reports nothing", () => {
  const unlisted: readonly string[] = [
    "export default { id: 'a', deps: [] }",
    "export default { id: 'a' }",
    "export default { deps: ['@keel/std-text'] }",
    "export default { deps: [''] }",
    "export default { deps: ['@keel/std-i18n/tools'] }",
    "export default { deps: ['@keel/std-i18n-x'] }",
    `export default { deps: DEPS }`,
    `export default { deps: [\`@keel/std-i18n\`] }`,
    `export default { deps: [...deps] }`,
    `export default { deps: ${DEP} }`,
    `export default { deps: { 0: ${DEP} } }`,
    `export default { [deps]: [${DEP}] }`,
    `export default { ['deps']: [${DEP}] }`,
    `export default { deps() { return [${DEP}] } }`,
    `export default { dependencies: [${DEP}] }`,
    `export default { id: 'a', meta: { deps: [${DEP}] } }`,
    `export default { ...{ deps: [${DEP}] } }`,
    `export default module()`,
    `export default module(...args)`,
    `export default module(options)`,
    `export default module(x => ({ deps: [${DEP}] }))`,
    `export default function m() { return { deps: [${DEP}] } }`,
    `export default class M { deps = [${DEP}] }`,
    `export default [${DEP}]`,
    `export default manifest`,
    `export default ${DEP}`,
    `export const manifest = { deps: [${DEP}] }`,
    `export default async function () {}`,
    `export { x as default } from './x'`,
    `const m = { deps: [${DEP}] }\nexport default m`,
    `export default module(module({ deps: [${DEP}] }))`,
    `export default { deps: [] } as const // ${DEP}`,
  ];
  for (const m of unlisted) expect(under(`${m}\n`), m).toEqual([]);
});

test("the first deps entry of the manifest object is the one read", () => {
  expect(under(`export default { deps: [], 'deps': [${DEP}] }\n`)).toEqual([]);
  expect(under(`export default { deps: [${DEP}], 'deps': [] }\n`).length).toBe(1);
});

test("the first default export is the manifest", () => {
  expect(under("export default function m() {}\nexport const x = 1\n")).toEqual([]);
  expect(under(`export const x = 1\nexport default { deps: [${DEP}] }\n`).length).toBe(1);
});
