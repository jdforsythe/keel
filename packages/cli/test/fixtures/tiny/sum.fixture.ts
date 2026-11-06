import { expect, it } from "vitest";

it("adds", () => {
  expect(1 + 1).toBe(2);
});

it("sees KEEL_TEST=1", () => {
  expect(process.env.KEEL_TEST).toBe("1");
});

it("fails on purpose", () => {
  expect(1 + 1).toBe(3);
});
