import { expect, it } from "vitest";
import { minorUnits } from "../modules/receipts/minorUnits.ts";

it("reads decimal amounts as minor units", () => {
  expect(minorUnits("12.50", "EUR")).toBe(1250);
  expect(minorUnits("12,5", "USD")).toBe(1250);
  expect(minorUnits(" 7 ", "GBP")).toBe(700);
  expect(minorUnits("1800", "JPY")).toBe(1800);
});

it("refuses other shapes", () => {
  for (const t of ["", "12.345", "-1", "1e3", "12.", "abc"]) expect(minorUnits(t, "EUR")).toBeNull();
  expect(minorUnits("18.5", "JPY")).toBeNull();
});
