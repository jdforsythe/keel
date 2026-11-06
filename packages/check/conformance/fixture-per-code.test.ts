// Seed 1337
// Each code has a fixture that triggers exactly that code and a clean counterpart (E1001, E1003, E1401, E1403, E1404).
// E1801 is not applicable here: it needs @keel/ui tokens and is covered by the ui suite.
import { check } from "@keel/check";
import { expect, test } from "vitest";
import { FIXTURES, one } from "./support.ts";

for (const fx of FIXTURES) {
  test(`${fx.code}: its fixture triggers exactly that code`, () => {
    const codes = new Set(check(one(fx.bad), {}).diagnostics.map((d) => d.code));
    expect(Array.from(codes)).toEqual([fx.code]);
  });
  test(`${fx.code}: its clean counterpart reports no ${fx.code}`, () => {
    const codes = check(one(fx.clean), {}).diagnostics.map((d) => d.code);
    expect(codes).not.toContain(fx.code);
  });
}
