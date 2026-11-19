// Seed 1337 (no random inputs)
import { s } from "@keel/schema";
import { Money } from "@keel/std-money";
import { expect, test } from "vitest";

test("registering money.Money twice with the same schema does not throw; lookup returns that schema and the registry size is unchanged", () => {
  const size = s.registry().size;
  expect(() => {
    s.register("money.Money", Money);
    s.register("money.Money", Money);
  }).not.toThrow();
  expect(s.registry().size).toBe(size);
  expect(s.registry().get("money.Money")).toBe(Money);
});

test("registering a different schema under money.Money throws 'registered to a different schema' and keeps Money", () => {
  const size = s.registry().size;
  expect(() => s.register("money.Money", s.int())).toThrow(/registered to a different schema/);
  expect(s.registry().size).toBe(size);
  expect(s.registry().get("money.Money")).toBe(Money);
});
