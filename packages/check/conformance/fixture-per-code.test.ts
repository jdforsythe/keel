// Seed 1337
// Every E code named in a kernel section's Rules has a fixture that triggers exactly that code and a clean
// counterpart, or is explain-only (check() cannot trigger it: runtime, cli, server, scaffold and testing codes,
// and codes whose rule is not implemented; RFC 0020). The code list is read from spec/kernel/*.md at test time.
import { check } from "@keel/check";
import { expect, test } from "vitest";
import { CODE_FIXTURES } from "./fixtures-by-code.ts";
import { specCodes } from "./spec-codes.ts";

const range = (p: string, a: number, b: number): string[] =>
  Array.from({ length: b - a + 1 }, (_, i) => `${p}${a + i}`);

export const EXPLAIN_ONLY: readonly string[] = [
  ...range("E", 1051, 1054),
  "E1056",
  ...range("E", 1101, 1103),
  ...range("E", 1201, 1206),
  ...range("E", 1251, 1254),
  ...range("E", 1351, 1354),
  ...range("E", 1502, 1506),
  ...range("E", 1551, 1554),
  ...range("E", 1651, 1653),
  ...range("E", 1702, 1706),
  "E1756",
  "E1801",
  "E1804",
  "E1806",
  "E1807",
  ...range("E", 1901, 1904),
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
