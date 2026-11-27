import { fixedTime } from "@keel/tooling/test-time";
// Seed 1337
import fc from "fast-check";
import { expect, it } from "vitest";
import { unifiedDiff } from "../src/internal/unifiedDiff.ts";
import { applyPatch } from "./support/applyPatch.ts";

const SEED = 1337;
const line = fc.constantFrom("a", "b", "c", "const x = 1", "", "  return y");
const text = fc
  .tuple(fc.array(line, { maxLength: 12 }), fc.boolean())
  .map(([ls, eol]) => (ls.length === 0 ? "" : `${ls.join("\n")}${eol ? "\n" : ""}`));

it(
  "git apply of unifiedDiff(a, b) turns a into b",
  () => {
    fc.assert(
      fc.property(text, text, (a, b) => {
        fc.pre(a !== b && a !== "" && b !== "");
        expect(applyPatch("src/f.ts", a, unifiedDiff("src/f.ts", a, b))).toBe(b);
      }),
      { seed: SEED, numRuns: 60 },
    );
  },
  fixedTime(60_000),
);

it("equal texts give no diff", () => {
  fc.assert(
    fc.property(text, (a) => {
      expect(unifiedDiff("f.ts", a, a)).toBe("");
    }),
    { seed: SEED, numRuns: 50 },
  );
});
