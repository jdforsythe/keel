// The read `secretValues` makes, with whether it was cut: a read that reaches its visit budget with values left unread
// says so, so a reader that must hold every value can fail closed. The budget is small here; the real one is 1,000,000.
import fc from "fast-check";
import { expect, test } from "vitest";
import { Secret } from "../src/Secret.ts";
import type { Node } from "../src/internal/Node.ts";
import { secretWalk } from "../src/internal/index.ts";
import { secretValues } from "../src/internal/secretValues.ts";

const json: Node = { kind: "json" };

test("a read that runs out of visits with values left is cut, and the values past it are not given", () => {
  const value = Secret.of(["a", "b", "c", "d"], json);
  // The secret and its array take one visit, then one per item.
  expect(secretWalk(value, 3)).toEqual({ values: ["a", "b"], cut: true });
});

test("a read that ends within its visits is not cut, also when the last visit is the budget's last", () => {
  const value = Secret.of(["a", "b", "c", "d"], json);
  expect(secretWalk(value, 5)).toEqual({ values: ["a", "b", "c", "d"], cut: false });
  expect(secretWalk(value, 6)).toEqual({ values: ["a", "b", "c", "d"], cut: false });
});

test("secretValues gives the values of the default read", () => {
  const value = Secret.of({ k: ["x", 1] }, json);
  expect(secretValues(value)).toEqual(secretWalk(value).values);
  expect(secretWalk(value).cut).toBe(false);
});

test("for every list and budget, cut holds exactly when the list needs more visits than the budget", () => {
  fc.assert(
    fc.property(fc.array(fc.string({ minLength: 1 }), { maxLength: 30 }), fc.nat(40), (items, budget) => {
      const read = secretWalk(Secret.of(items, json), budget);
      expect(read.cut).toBe(items.length + 1 > budget);
      expect(read.values).toEqual(items.slice(0, Math.max(0, budget - 1)));
    }),
    { seed: 1337 },
  );
});
