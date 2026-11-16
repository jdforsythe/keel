import { expect, test } from "vitest";
import { explain } from "../src/explain.ts";

test.each(["E1715", "E1716", "E1717", "E1718"])("%s has an explanation within the token bound", (code) => {
  const text = explain(code);
  expect(text).toContain(code);
  expect(text).not.toContain("not a known code");
  expect(text).toContain("k.prove");
  expect(Math.ceil(text.length / 4)).toBeLessThanOrEqual(120);
});

test("E1716 carries the safe integer range hint", () => {
  expect(explain("E1716")).toContain("safe integer range");
  expect(explain("E1716")).toContain("s.int({ max: 1000 })");
});
