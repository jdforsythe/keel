// Spec: k.errors, clause "Each of E1451-E1454 has a fixture that triggers it and a clean counterpart."
// Seed 1337
// Every E code named in a kernel section's Rules has a fixture that triggers exactly that code and a clean
// counterpart, or is explain-only (check() cannot trigger it: runtime, cli, server, scaffold and testing codes,
// and codes whose rule is not implemented; RFC 0020, triaged by RFC 0040). The code list is read from
// spec/kernel/*.md at test time.
import { check } from "@keel/check";
import { expect, test } from "vitest";
import { CODE_FIXTURES } from "./fixtures-by-code.ts";
import { specCodes } from "./spec-codes.ts";

const range = (p: string, a: number, b: number): string[] =>
  Array.from({ length: b - a + 1 }, (_, i) => `${p}${a + i}`);

export const EXPLAIN_ONLY: readonly string[] = [
  ...range("E", 1051, 1054),
  "E1056",
  "E1057",
  ...range("E", 1201, 1203),
  "E1205",
  "E1206",
  "E1253",
  ...range("E", 1351, 1354),
  "E1006",
  "E1049",
  ...range("E", 1502, 1506),
  ...range("E", 1552, 1555),
  ...range("E", 1702, 1707),
  "E1756",
  "E1801",
  "E1804",
  "E1807",
  "E1902",
];

test("every spec Rules code has a fixture or is listed explain-only, never both", () => {
  const spec = specCodes();
  expect(spec.length).toBeGreaterThan(70);
  const fixtured = Object.keys(CODE_FIXTURES);
  expect(spec.filter((c) => !fixtured.includes(c) && !EXPLAIN_ONLY.includes(c))).toEqual([]);
  expect(fixtured.filter((c) => EXPLAIN_ONLY.includes(c))).toEqual([]);
  expect([...fixtured, ...EXPLAIN_ONLY].filter((c) => !spec.includes(c))).toEqual([]);
});

for (const [code, fx] of Object.entries(CODE_FIXTURES)) {
  test(`${code}: its fixture triggers exactly that code`, () => {
    const codes = new Set(check(fx.bad, fx.badOpts ?? fx.opts).diagnostics.map((d) => d.code));
    expect(Array.from(codes)).toEqual([code]);
  });
  test(`${code}: its clean counterpart reports no ${code}`, () => {
    const codes = check(fx.clean, fx.cleanOpts ?? fx.opts).diagnostics.map((d) => d.code);
    expect(codes).not.toContain(code);
  });
}
