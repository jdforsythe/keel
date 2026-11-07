// Spec: std.money, clause "After importing `@keel/std-money`, `s.registry().get('money.Money')` is `Money` and `s.registry().get('money.Currency')` is `Currency`; importing it again does not throw."
// Seed 1337 (no random inputs)
import { s } from "@keel/schema";
import { Currency, Money } from "@keel/std-money";
import { expect, test } from "vitest";

test("After importing `@keel/std-money`, `s.registry().get('money.Money')` is `Money` and `s.registry().get('money.Currency')` is `Currency`; importing it again does not throw.", async () => {
  expect(s.registry().get("money.Money")).toBe(Money);
  expect(s.registry().get("money.Currency")).toBe(Currency);
  await expect(import("@keel/std-money")).resolves.toBeDefined();
  expect(s.registry().get("money.Money")).toBe(Money);
});
