// Exact-output tests for unifiedDiff and diffEdits (mutation killers).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { diffEdits } from "../src/internal/diffEdits.ts";
import { unifiedDiff } from "../src/internal/unifiedDiff.ts";

const SEED = 1337;
const nums = (from: number, to: number): string[] => {
  const out: string[] = [];
  for (let n = from; n <= to; n++) out.push(`l${n}`);
  return out;
};
const text = (ls: readonly string[]): string => ls.map((l) => `${l}\n`).join("");

describe("unifiedDiff exact output", () => {
  it("replace in the middle: 3 lines of context, delete before insert", () => {
    const a = nums(1, 10);
    const b = a.map((l) => (l === "l5" ? "X" : l));
    expect(unifiedDiff("f.ts", text(a), text(b))).toBe(
      ["--- a/f.ts", "+++ b/f.ts", "@@ -2,7 +2,7 @@", " l2", " l3", " l4", "-l5", "+X", " l6", " l7", " l8"].join("\n"),
    );
  });

  it("identical, and trailing-newline-only differences, give the empty string", () => {
    expect(unifiedDiff("f", "a\nb\n", "a\nb\n")).toBe("");
    expect(unifiedDiff("f", "a\nb", "a\nb\n")).toBe("");
    expect(unifiedDiff("f", null, null)).toBe("");
    expect(unifiedDiff("f", null, "")).toBe("");
    expect(unifiedDiff("f", "", null)).toBe("");
    expect(unifiedDiff("f", "", "")).toBe("");
  });

  it("only one trailing empty element is dropped", () => {
    expect(unifiedDiff("f", "a\n\n", "a\n")).toBe(["--- a/f", "+++ b/f", "@@ -1,2 +1,1 @@", " a", "-"].join("\n"));
  });

  it("a change at the first and the last line clamps its context", () => {
    expect(unifiedDiff("f", text(["a", "b"]), text(["X", "b"]))).toBe(
      ["--- a/f", "+++ b/f", "@@ -1,2 +1,2 @@", "-a", "+X", " b"].join("\n"),
    );
    expect(unifiedDiff("f", text(["a", "b"]), text(["a", "X"]))).toBe(
      ["--- a/f", "+++ b/f", "@@ -1,2 +1,2 @@", " a", "-b", "+X"].join("\n"),
    );
  });

  it("created and removed files", () => {
    expect(unifiedDiff("f", null, "x\ny\n")).toBe(
      ["--- /dev/null", "+++ b/f", "@@ -0,0 +1,2 @@", "+x", "+y"].join("\n"),
    );
    expect(unifiedDiff("f", "x\ny\n", null)).toBe(
      ["--- a/f", "+++ /dev/null", "@@ -1,2 +0,0 @@", "-x", "-y"].join("\n"),
    );
    expect(unifiedDiff("f", "", "x\n")).toBe(["--- a/f", "+++ b/f", "@@ -0,0 +1,1 @@", "+x"].join("\n"));
    expect(unifiedDiff("f", "x\n", "")).toBe(["--- a/f", "+++ b/f", "@@ -1,1 +0,0 @@", "-x"].join("\n"));
  });

  it("pure insertion", () => {
    expect(unifiedDiff("f", "a\nb\n", "a\nX\nb\n")).toBe(
      ["--- a/f", "+++ b/f", "@@ -1,2 +1,3 @@", " a", "+X", " b"].join("\n"),
    );
  });

  it("changes 7 ops apart are separate hunks with their own line numbers", () => {
    const a = nums(1, 20);
    const b = a.filter((l) => l !== "l4" && l !== "l11");
    expect(unifiedDiff("f", text(a), text(b))).toBe(
      [
        "--- a/f",
        "+++ b/f",
        "@@ -1,7 +1,6 @@",
        " l1",
        " l2",
        " l3",
        "-l4",
        " l5",
        " l6",
        " l7",
        "@@ -8,7 +7,6 @@",
        " l8",
        " l9",
        " l10",
        "-l11",
        " l12",
        " l13",
        " l14",
      ].join("\n"),
    );
  });

  it("changes 6 ops apart merge into one hunk", () => {
    const a = nums(1, 20);
    const b = a.filter((l) => l !== "l4" && l !== "l10");
    const out = unifiedDiff("f", text(a), text(b));
    expect(out.split("\n").filter((l) => l.startsWith("@@"))).toEqual(["@@ -1,13 +1,11 @@"]);
    expect(out.split("\n")).toHaveLength(2 + 1 + 13 - 0 + 0);
  });

  it("later hunk offsets count earlier insertions on the new side only", () => {
    const a = nums(1, 20);
    const b = ["X", "Y", ...a.filter((l) => l !== "l18")];
    const hunks = unifiedDiff("f", text(a), text(b))
      .split("\n")
      .filter((l) => l.startsWith("@@"));
    expect(hunks).toEqual(["@@ -1,3 +1,5 @@", "@@ -15,6 +17,5 @@"]);
  });

  it("later hunk offsets count earlier deletions on the old side only", () => {
    const a = nums(1, 20);
    const b = a.filter((l) => l !== "l1" && l !== "l2" && l !== "l18");
    const hunks = unifiedDiff("f", text(a), text(b))
      .split("\n")
      .filter((l) => l.startsWith("@@"));
    expect(hunks).toEqual(["@@ -1,5 +1,3 @@", "@@ -15,6 +13,5 @@"]);
  });

  it("zero-count old side reports line - 1", () => {
    expect(unifiedDiff("f", "", "a\nb\n").split("\n")[2]).toBe("@@ -0,0 +1,2 @@");
  });

  it("LCS keeps common lines (no delete/insert of matching ones)", () => {
    expect(unifiedDiff("f", text(["a", "b", "c"]), text(["b", "c", "d"]))).toBe(
      ["--- a/f", "+++ b/f", "@@ -1,3 +1,3 @@", "-a", " b", " c", "+d"].join("\n"),
    );
    expect(unifiedDiff("f", text(["a", "x", "b"]), text(["a", "b", "x"]))).toBe(
      ["--- a/f", "+++ b/f", "@@ -1,3 +1,3 @@", " a", "-x", " b", "+x"].join("\n"),
    );
    expect(unifiedDiff("f", text(["x", "a", "b"]), text(["a", "b", "x"]))).toBe(
      ["--- a/f", "+++ b/f", "@@ -1,3 +1,3 @@", "-x", " a", " b", "+x"].join("\n"),
    );
    expect(unifiedDiff("f", text(["a", "b", "x"]), text(["x", "a", "b"]))).toBe(
      ["--- a/f", "+++ b/f", "@@ -1,3 +1,3 @@", "+x", " a", " b", "-x"].join("\n"),
    );
  });

  it("a table of exactly 4,000,000 cells is still an LCS diff; one more line falls back to replacement", () => {
    const same2000 = text(Array.from({ length: 2000 }, (_, i) => `n${i}`));
    expect(unifiedDiff("f", same2000, same2000)).toBe("");
    const a = Array.from({ length: 2001 }, (_, i) => `n${i}`);
    const out = unifiedDiff("f", text(a), text(a)).split("\n");
    expect(out[2]).toBe("@@ -1,2001 +1,2001 @@");
    expect(out.slice(3, 5)).toEqual(["-n0", "-n1"]);
    expect(out[3 + 2001]).toBe("+n0");
    expect(out).toHaveLength(3 + 4002);
  });

  it("property: hunk header counts match the body", () => {
    const line = fc.constantFrom("a", "b", "c", "d");
    fc.assert(
      fc.property(fc.array(line, { maxLength: 30 }), fc.array(line, { maxLength: 30 }), (xs, ys) => {
        const out = unifiedDiff("f", text(xs), text(ys));
        if (out === "") {
          expect(xs).toEqual(ys);
          return;
        }
        const ls = out.split("\n").slice(2);
        let oldN = 0;
        let newN = 0;
        let expOld = 0;
        let expNew = 0;
        for (const l of ls) {
          const m = /^@@ -\d+(?:,(\d+))? \+\d+(?:,(\d+))? @@$/.exec(l);
          if (m !== null) {
            expOld += Number(m[1]);
            expNew += Number(m[2]);
          } else {
            if (l[0] !== "+") oldN++;
            if (l[0] !== "-") newN++;
          }
        }
        expect([oldN, newN]).toEqual([expOld, expNew]);
      }),
      { seed: SEED, numRuns: 200 },
    );
  });
});

describe("diffEdits exact edits", () => {
  const edit = (sl: number, el: number, newText: string) => ({
    range: { start: { line: sl, character: 0 }, end: { line: el, character: 0 } },
    newText,
  });

  it("a hunk replaces its old range (1-based start) with context and added lines", () => {
    const d = ["--- a/f", "+++ b/f", "@@ -2,3 +2,3 @@", " a", "-b", "+c", " d"].join("\n");
    expect(diffEdits(d)).toEqual(new Map([["f", [edit(1, 4, "a\nc\nd\n")]]]));
  });

  it("zero old count inserts at the start line itself", () => {
    expect(diffEdits("--- /dev/null\n+++ b/n\n@@ -0,0 +1,2 @@\n+x\n+y")).toEqual(
      new Map([["n", [edit(0, 0, "x\ny\n")]]]),
    );
    expect(diffEdits("--- a/f\n+++ b/f\n@@ -4,0 +5,1 @@\n+x")).toEqual(new Map([["f", [edit(4, 4, "x\n")]]]));
  });

  it("an omitted count means 1", () => {
    expect(diffEdits("--- a/f\n+++ b/f\n@@ -5 +5 @@\n-a\n+b")).toEqual(new Map([["f", [edit(4, 5, "b\n")]]]));
  });

  it("negative starts clamp to line 0", () => {
    expect(diffEdits("--- a/f\n+++ b/f\n@@ -0,3 +1,3 @@\n+x")).toEqual(new Map([["f", [edit(0, 2, "x\n")]]]));
  });

  it("path from --- a/ alone; removal keeps it past +++ /dev/null", () => {
    expect(diffEdits("--- a/f\n@@ -1,1 +0,0 @@\n-x")).toEqual(new Map([["f", [edit(0, 1, "")]]]));
    expect(diffEdits("--- a/f\n+++ /dev/null\n@@ -1,1 +0,0 @@\n-x")).toEqual(new Map([["f", [edit(0, 1, "")]]]));
  });

  it("+++ b/ wins over --- a/", () => {
    expect(diffEdits("--- a/old\n+++ b/new\n@@ -1,1 +1,1 @@\n+x")).toEqual(new Map([["new", [edit(0, 1, "x\n")]]]));
  });

  it("no path, or a --- line that is not a/, yields nothing until a path appears", () => {
    expect(diffEdits("@@ -1,1 +1,1 @@\n+x").size).toBe(0);
    expect(diffEdits("--- /dev/null\n@@ -1,1 +1,1 @@\n+x").size).toBe(0);
    expect(diffEdits("--- a/f\n--- /dev/null\n@@ -1,1 +1,1 @@\n+x").size).toBe(0);
    expect(diffEdits("").size).toBe(0);
  });

  it("multiple hunks and files accumulate in order", () => {
    const d = [
      "--- a/f",
      "+++ b/f",
      "@@ -1,1 +1,1 @@",
      "+a",
      "@@ -9,1 +9,1 @@",
      " z",
      "--- a/g",
      "+++ b/g",
      "@@ -3,1 +3,1 @@",
      "+g",
    ].join("\n");
    expect(diffEdits(d)).toEqual(
      new Map([
        ["f", [edit(0, 1, "a\n"), edit(8, 9, "z\n")]],
        ["g", [edit(2, 3, "g\n")]],
      ]),
    );
  });

  it("a malformed @@ line drops its hunk; stray and empty lines are not text", () => {
    expect(diffEdits("--- a/f\n+++ b/f\n@@ nonsense\n+x").size).toBe(0);
    expect(diffEdits("--- a/f\n+++ b/f\n@@ -1,2 +1,2 @@\n+x\n\n-y\n\\ No newline\n z")).toEqual(
      new Map([["f", [edit(0, 2, "x\nz\n")]]]),
    );
    expect(diffEdits("--- a/f\n+++ b/f\n+x").size).toBe(0);
    expect(diffEdits("--- a/f\n+++ b/f\n@@ -1,1 +1,1 @@\n+x\n@@ garbage\n+y")).toEqual(
      new Map([["f", [edit(0, 1, "x\n")]]]),
    );
  });

  it("an @@ prefix needs the full header form", () => {
    expect(diffEdits("--- a/f\n+++ b/f\nx@@ -1,1 +1,1 @@\n+x").size).toBe(0);
    expect(diffEdits("--- a/f\n+++ b/f\n@@ -a,1 +1,1 @@\n+x").size).toBe(0);
    expect(diffEdits("--- a/f\n+++ b/f\n@@ -1,1 -1,1 @@\n+x").size).toBe(0);
    expect(diffEdits("--- a/f\n+++ b/f\n@@ -1,1 +1,1 x\n+x").size).toBe(0);
  });
});
