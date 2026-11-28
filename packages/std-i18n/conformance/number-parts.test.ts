// Spec: std.i18n, clause "`numberParts(1234567.5, 'de-DE')` joined is `1.234.567,5`; `numberParts('-0.05', 'en-US', 'EUR')` joined is `-€0.05`; `numberParts(1, 'en-US', 'USD', 'narrowSymbol')` holds the part `{ type: 'currency', value: '$' }`."
// Seed 1337 (no random inputs)
import { numberParts } from "@keel/std-i18n";
import { expect, test } from "vitest";

const joined = (parts: readonly { value: string }[]): string => parts.map((p) => p.value).join("");

test("`numberParts(1234567.5, 'de-DE')` joined is `1.234.567,5`", () => {
  expect(joined(numberParts(1234567.5, "de-DE"))).toBe("1.234.567,5");
});

test("`numberParts('-0.05', 'en-US', 'EUR')` joined is `-€0.05`", () => {
  expect(joined(numberParts("-0.05", "en-US", "EUR"))).toBe("-€0.05");
});

test("`numberParts(1, 'en-US', 'USD', 'narrowSymbol')` holds the part `{ type: 'currency', value: '$' }`", () => {
  expect(numberParts(1, "en-US", "USD", "narrowSymbol")).toContainEqual({ type: "currency", value: "$" });
});
