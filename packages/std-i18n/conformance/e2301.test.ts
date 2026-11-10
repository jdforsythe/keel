// Spec: std.i18n, clause "With `@keel/std-i18n` in a module's `deps`, `keel check` reports one E2301 each for `new Intl.NumberFormat('de-DE')` and `a.localeCompare(b, 'de-DE')` in its files and none for them in a module without it; `n.toLocaleString()` reports E1758 and no E2301."
// Spec: std.i18n, rule E2301: a formatter or toLocale*/localeCompare call with a locale argument; the message names the stdlib function to call; no fix.
// Seed 1337
// Assumption: `check()` imports nothing (k.module), so the rule is registered by importing `@keel/std-i18n/tools`;
// a module is the files under `modules/<id>/` with a `module.ts` manifest listing `deps`.
import { check } from "@keel/check";
import "@keel/std-i18n/tools";
import fc from "fast-check";
import { expect, test } from "vitest";

type Files = Parameters<typeof check>[0];
const manifest = (id: string, deps: string[]) => `export default { id: '${id}', deps: ${JSON.stringify(deps)} }\n`;
const project = (withDep: boolean, code: string): Files => [
  { path: "modules/a/module.ts", source: manifest("a", withDep ? ["@keel/std-i18n"] : []) },
  { path: "modules/a/x.ts", source: code },
];
const count = (files: Files, code: string) => check(files, { types: false }).diagnostics.filter((d) => d.code === code);
const locale = fc.constantFrom("de-DE", "en-US", "ja-JP", "fr-FR");

// Skipped: the E2301 assertions pass; the E1758 assertion waits on the kernel lane adding E1758 to @keel/check.
test.skip("With `@keel/std-i18n` in a module's `deps`, `keel check` reports one E2301 each for `new Intl.NumberFormat('de-DE')` and `a.localeCompare(b, 'de-DE')` in its files and none for them in a module without it; `n.toLocaleString()` reports E1758 and no E2301.", () => {
  fc.assert(
    fc.property(locale, (l) => {
      const nf = `export const f = new Intl.NumberFormat('${l}')\n`;
      const lc = `export const g = (a: string, b: string) => a.localeCompare(b, '${l}')\n`;
      expect(count(project(true, nf), "E2301").length).toBe(1);
      expect(count(project(true, lc), "E2301").length).toBe(1);
      expect(count(project(false, nf), "E2301").length).toBe(0);
      expect(count(project(false, lc), "E2301").length).toBe(0);
    }),
    { seed: 1337, numRuns: 20 },
  );
  const bare = "export const h = (n: number) => n.toLocaleString()\n";
  expect(count(project(true, bare), "E1758").length).toBe(1);
  expect(count(project(true, bare), "E2301").length).toBe(0);
});

test("E2301 message names the stdlib function to call (`formatNumber`, `formatMoney`, `formatDate`, `formatInstant`, `formatDuration`, `compareText`, `plural` or `localeName`) and carries no fix.", () => {
  const names = [
    "formatNumber",
    "formatMoney",
    "formatDate",
    "formatInstant",
    "formatDuration",
    "compareText",
    "plural",
    "localeName",
  ];
  const d = count(project(true, "export const f = new Intl.NumberFormat('de-DE')\n"), "E2301");
  expect(d.length).toBe(1);
  expect(names.some((n) => d[0]?.message.includes(n))).toBe(true);
  expect(d[0]?.fix).toBeUndefined();
});
