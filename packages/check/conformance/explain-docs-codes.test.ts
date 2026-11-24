// Spec: k.check "Every E code in a kernel section's Rules ... has an `explain` entry of at most 120 tokens"; k.docs Rules E1065, E1066; k.scaffold Rules E1355, W1356; k.scaffold-service Rules E1358.
// Seed: none (fixed code list). Red: `explain` has no entry for a code here until it is added.
import { explain } from "@keel/check/explain";
import { expect, test } from "vitest";
import { approxTokens } from "./support.ts";

for (const [code, word] of [
  ["E1065", ""],
  ["E1066", ""],
  ["E1355", ""],
  ["E1358", "--reason"],
  ["W1356", "keel docs --sync"],
] as const) {
  test(`explain ${code} names the code, at most 120 tokens, ${word === "" ? "" : ` and names ${word}`}`, () => {
    const text = explain(code);
    expect(text).toContain(code);
    expect(approxTokens(text)).toBeLessThanOrEqual(120);
    expect(text).toContain(word);
    // a row, not the fallback text an unknown code gets
    const unknown = explain("E9998");
    expect(text.replaceAll(code, "#")).not.toBe(unknown.replaceAll("E9998", "#"));
  });
}
