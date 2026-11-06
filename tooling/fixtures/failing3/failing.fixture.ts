import { describe, expect, it } from "vitest";

describe("cart", () => {
  it("adds an item", () => {
    expect({ items: [1, 2], total: 3 }).toEqual({ items: [1], total: 1 });
  });
  it("removes an item", () => {
    expect(["a", "b"]).toEqual(["a"]);
  });
  it("totals", () => {
    expect(2 + 2).toBe(5);
  });
  it("passes silently", () => {
    expect(1).toBe(1);
  });
});
