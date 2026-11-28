// Spec: k.errors, clause "Each code of Rules has a fixture that triggers it and a clean counterpart."
// Seed 1337
// Every fixture triggers exactly its code and its clean counterpart does not; which codes need one is
// `reportedCodes()` (RFC 0065, asserted in explain-and-fixture-per-code.test.ts).
import { readFileSync } from "node:fs";
import { check, reportedCodes } from "@keel/check";
import { expect, test } from "vitest";
import { CODE_FIXTURES } from "./fixtures-by-code.ts";

test("E1451-E1454 have fixtures, and every fixture is for a code check() reports", () => {
  const reported = reportedCodes();
  expect(["E1451", "E1452", "E1453", "E1454"].filter((c) => !Object.hasOwn(CODE_FIXTURES, c))).toEqual([]);
  expect(Object.keys(CODE_FIXTURES).length).toBeGreaterThan(45);
  expect(Object.keys(CODE_FIXTURES).filter((c) => !reported.includes(c))).toEqual([]);
});

test("each code of k.errors' Rules has a fixture", () => {
  const rules = readFileSync(new URL("../../../spec/kernel/k.errors.md", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.startsWith("- E1"))
    .flatMap((l) => [...l.matchAll(/\bE1\d{3}\b/g)].map((m) => m[0]));
  expect(rules.length).toBeGreaterThan(5);
  expect([...new Set(rules)].filter((c) => !Object.hasOwn(CODE_FIXTURES, c))).toEqual([]);
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
