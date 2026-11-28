// Spec: k.explain, clause "`explain('E1762')` ends with the line `see: k.identity`, and no `explain(code)` of a kernel code holds `...` or `…` in its `see` line."
// Spec: k.explain, clause "No `spec/kernel/*.md` section, `proposed` ones included, names in its Rules a code `explain` answers as unknown."
// Seed 1337 (no random input: codes are read from `reportedCodes()` and from the Rules paragraphs of spec/kernel/*.md).
import { reportedCodes } from "@keel/check";
import { explain } from "@keel/check/explain";
import { describe, expect, it } from "vitest";
import { specCodes } from "./spec-codes.ts";

const kernel = (c: string): boolean => /^E1\d{3}$/.test(c);
const KERNEL: readonly string[] = [
  ...new Set([...reportedCodes().filter(kernel), ...specCodes().filter(kernel)]),
].sort();
const lastLine = (text: string): string => text.trimEnd().split("\n").pop() ?? "";

describe("k.explain: see is whole", () => {
  it("`explain('E1762')` ends with the line `see: k.identity`", () => {
    expect(lastLine(explain("E1762"))).toBe("see: k.identity");
  });

  it("no `explain(code)` of a kernel code holds `...` or `…` in its `see` line", () => {
    expect(KERNEL.length).toBeGreaterThan(45);
    const cut = KERNEL.filter((c) => {
      const see = explain(c)
        .split("\n")
        .filter((l) => l.startsWith("see:"));
      return see.length !== 1 || see[0]?.includes("...") === true || see[0]?.includes("…") === true;
    });
    expect(cut).toEqual([]);
  });
});

describe("k.explain: Rules name registered codes", () => {
  it("no spec/kernel section, proposed ones included, names in its Rules a code `explain` answers as unknown", () => {
    const unknown = specCodes().filter((c) => /is not a known code/.test(explain(c)));
    expect(unknown).toEqual([]);
  });

  it("E1260 is named by no section's Rules", () => {
    expect(specCodes()).not.toContain("E1260");
  });
});
