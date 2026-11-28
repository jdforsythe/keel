import { expect, it } from "vitest";
import { Point } from "../src/index.ts";

it("refuses a value that is not a finite number", () => {
  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])
    expect(Point.parse({ name: "Mon", value, shown: "?" }).ok).toBe(false);
});

it("refuses a blank name or shown value", () => {
  expect(Point.parse({ name: " ", value: 1, shown: "1" }).ok).toBe(false);
  expect(Point.parse({ name: "Mon", value: 1, shown: "" }).ok).toBe(false);
});

it("takes the largest and smallest finite numbers", () => {
  expect(Point.parse({ name: "Mon", value: Number.MAX_VALUE, shown: "a lot" }).ok).toBe(true);
  expect(Point.parse({ name: "Mon", value: -Number.MAX_VALUE, shown: "very little" }).ok).toBe(true);
});
