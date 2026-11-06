// Seed 1337
import { check, format } from "@keel/check";
import { expect, test } from "vitest";
import { FIXTURES, lines, one } from "./support.ts";

test("compact: passing is silent except the trailer line", () => {
  const fx = FIXTURES[1];
  const { diagnostics } = check(one(fx?.clean ?? ""), {});
  expect(diagnostics).toEqual([]);
  expect(lines(format(diagnostics, { mode: "compact" })).length).toBe(1);
});

test("compact: no diagnostics and no files yields exactly one trailer line", () => {
  const out = format(check([], {}).diagnostics, { mode: "compact" });
  expect(lines(out).length).toBe(1);
});
