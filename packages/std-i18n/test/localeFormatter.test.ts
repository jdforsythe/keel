// Seed 1337 (no random inputs)
import { check } from "@keel/check";
import { expect, test } from "vitest";
import { localeFormatter } from "../src/tools/localeFormatter.ts";

type Files = Parameters<typeof check>[0];
const manifest = (deps: string) =>
  `import { module } from '@keel/kernel'\nexport default module({ id: 'a', deps: ${deps} })\n`;
const files = (code: string, deps = "['@keel/std-i18n']"): Files => [
  { path: "modules/a/module.ts", source: manifest(deps) },
  { path: "modules/a/x.ts", source: code },
];
const e2301 = (fs: Files) => check(fs, { types: false }).diagnostics.filter((d) => d.code === localeFormatter.code);

test("each locale-taking call names its stdlib replacement", () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    ["new Intl.NumberFormat('de-DE').format(1)", "formatNumber"],
    ["new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })", "formatMoney"],
    ["Intl.NumberFormat('de-DE')", "formatNumber"],
    ["new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC' })", "formatDate or formatInstant"],
    ["new Intl.PluralRules('de-DE')", "plural"],
    ["new Intl.DisplayNames(['de-DE'], { type: 'language' })", "localeName"],
    ["new Intl.Collator('de-DE')", "compareText"],
    ["new Intl.RelativeTimeFormat('de-DE')", "formatDuration"],
    ["n.toLocaleString('de-DE')", "formatNumber, formatMoney or formatInstant"],
    ["d.toLocaleDateString('de-DE', { timeZone: 'UTC' })", "formatDate"],
    ["d.toLocaleTimeString('de-DE', { timeZone: 'UTC' })", "formatInstant"],
    ["a.localeCompare(b, 'de-DE')", "compareText"],
  ];
  for (const [code, use] of cases) {
    const d = e2301(files(`export const f = (n: number, d: Date, a: string, b: string) => ${code}\n`));
    expect(d.length, code).toBe(1);
    expect(d[0]?.message).toContain(use);
    expect(d[0]?.message.length).toBeLessThan(90);
    expect(d[0]?.line).toBe(1);
    expect(d[0]?.fix).toBeUndefined();
  }
});

test("calls without a locale, or with `undefined`, are not E2301", () => {
  const code = [
    "export const a = new Intl.NumberFormat()",
    "export const b = (n: number) => n.toLocaleString()",
    "export const c = (x: string, y: string) => x.localeCompare(y)",
    "export const d = new Intl.Collator(undefined)",
    "export const e = new Intl.Segmenter('de-DE')",
    "export const g = (x: { localeCompare(o: string): number }) => x.localeCompare('de-DE')",
    "",
  ].join("\n");
  expect(e2301(files(code))).toEqual([]);
});

test("a module scopes by its own manifest: a nested module without the dep is not E2301", () => {
  const code = "export const f = new Intl.NumberFormat('de-DE')\n";
  const fs: Files = [
    ...files(code),
    { path: "modules/a/inner/module.ts", source: manifest("[]") },
    { path: "modules/a/inner/y.ts", source: code },
    { path: "lib/z.ts", source: code },
  ];
  expect(e2301(fs).map((d) => d.path)).toEqual(["modules/a/x.ts"]);
});

test("a manifest whose deps are not a literal string array, or that has no default object, lists nothing", () => {
  const code = "export const f = new Intl.NumberFormat('de-DE')\n";
  expect(e2301(files(code, "DEPS"))).toEqual([]);
  expect(
    e2301([{ path: "modules/a/module.ts", source: "export default function m() {}\n" }, ...files(code).slice(1)]),
  ).toEqual([]);
  const plain: Files = [
    { path: "modules/a/module.ts", source: "export default { id: 'a', 'deps': ['@keel/std-i18n'] } as const\n" },
    { path: "modules/a/x.ts", source: code },
  ];
  expect(e2301(plain).length).toBe(1);
});

test("several calls in one file are reported in source order with their line and col", () => {
  const code =
    "export const a = new Intl.PluralRules('de-DE')\nexport const b = (x: string, y: string) =>\n  x.localeCompare(y, 'de-DE')\n";
  expect(e2301(files(code)).map((d) => [d.line, d.col])).toEqual([
    [1, 18],
    [3, 3],
  ]);
});
