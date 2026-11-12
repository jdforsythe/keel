import { describe, expect, test } from "vitest";
import { canonical } from "../src/internal/canonical.ts";

describe("canonical", () => {
  test("object keys compare in any order", () => {
    expect(canonical({ a: 1, b: [1, 2] })).toBe(canonical({ b: [1, 2], a: 1 }));
  });
  test("an array of objects with a string id compares as a set keyed by id", () => {
    expect(
      canonical([
        { id: "b", v: 1 },
        { id: "a", v: 2 },
      ]),
    ).toBe(
      canonical([
        { v: 2, id: "a" },
        { id: "b", v: 1 },
      ]),
    );
    expect(canonical([{ id: "a", v: 1 }])).not.toBe(canonical([{ id: "a", v: 2 }]));
  });
  test("any other array keeps its order", () => {
    expect(canonical([1, 2])).not.toBe(canonical([2, 1]));
    expect(canonical([{ id: 1 }, { id: 2 }])).not.toBe(canonical([{ id: 2 }, { id: 1 }]));
    expect(canonical([{ id: "a" }, 3])).not.toBe(canonical([3, { id: "a" }]));
  });
});
