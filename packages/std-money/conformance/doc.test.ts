// Spec: std.money, clause "`Money.doc()` is a closed-object doc naming `amount` and `currency` and each currency code."
// Seed 1337 (no random inputs)
import { Money } from "@keel/std-money";
import { expect, test } from "vitest";

test("`Money.doc()` is a closed-object doc naming `amount` and `currency` and each currency code.", () => {
  const doc = Money.doc();
  expect(doc.startsWith("{|")).toBe(true);
  expect(doc).toContain("amount");
  expect(doc).toContain("currency");
  for (const code of ["EUR", "GBP", "JPY", "USD"]) expect(doc).toContain(code);
});
