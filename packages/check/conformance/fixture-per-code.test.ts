// Spec: k.errors, clause "Each of E1451-E1454 has a fixture that triggers it and a clean counterpart."
// Seed 1337
// Every fixture triggers exactly its code and its clean counterpart does not; which codes need one is
// `reportedCodes()` (RFC 0065, asserted in explain-and-fixture-per-code.test.ts).
import { check, reportedCodes } from "@keel/check";
import { expect, test } from "vitest";
import { CODE_FIXTURES } from "./fixtures-by-code.ts";

test("E1451-E1454 have fixtures, and every fixture is for a code check() reports", () => {
  const reported = reportedCodes();
  expect(["E1451", "E1452", "E1453", "E1454"].filter((c) => !Object.hasOwn(CODE_FIXTURES, c))).toEqual([]);
  expect(Object.keys(CODE_FIXTURES).length).toBeGreaterThan(45);
  expect(Object.keys(CODE_FIXTURES).filter((c) => !reported.includes(c))).toEqual([]);
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
