import { expect, it } from "vitest";

it("asserts", () => {
  expect({ a: 1 }).toEqual({ a: 2 });
});
