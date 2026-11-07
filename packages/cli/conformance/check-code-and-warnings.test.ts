// Spec: k.check, clauses "`--code E1501` emits only E1501 diagnostics while the summary counts every code." and
// "A tree with only W diagnostics exits 0." Driven through `run`. Seed 1337 (no generated inputs).
import { defineRule } from "@keel/check";
import { describe, expect, it } from "vitest";
import { dirtyFile, keel, lines, parseJsonLines } from "./fixtures";

const link = {
  path: "src/C.tsx",
  source: `import { Link } from '@keel/ui'\nexport default function C() { return <Link to="/orders">x</Link> }\n`,
};

describe("k.check --code and W-only trees", () => {
  it("`--code E1501` emits only E1501 diagnostics while the summary counts every code", async () => {
    const files = [link, dirtyFile(1), dirtyFile(2)];
    const all = await keel(["check", "--format=json"], { files });
    const only = await keel(["check", "--code", "E1501", "--format=json"], { files });
    const allRecs = parseJsonLines(all.stdout);
    const recs = parseJsonLines(only.stdout);
    const diags = recs.filter((r) => r.kind === "diag");
    expect(diags.length).toBeGreaterThan(0);
    for (const d of diags) expect(d.code).toBe("E1501");
    expect(allRecs.some((r) => r.kind === "diag" && r.code !== "E1501")).toBe(true);
    const sum = recs.find((r) => r.kind === "summary");
    expect(sum).toBeDefined();
    expect(sum).toEqual(allRecs.find((r) => r.kind === "summary"));
    expect(only.code).toBe(all.code);
  });

  it("A tree with only W diagnostics exits 0", async () => {
    defineRule({
      code: "W2961",
      message: "warn marker",
      see: "k.check",
      explain: "Marker identifier found.",
      check: ({ file }) => {
        const out: { path: string; line: number; col: number }[] = [];
        file.source.split("\n").forEach((text, i) => {
          const at = text.indexOf("warnMarker");
          if (at >= 0) out.push({ path: file.path, line: i + 1, col: at + 1 });
        });
        return out;
      },
    });
    const w = { path: "src/warnMarker.ts", source: "export const warnMarker = 1\n" };
    const r = await keel(["check", "--format=compact"], { files: [w] });
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("W2961");
    const mixed = await keel(["check", "--format=compact"], { files: [w, dirtyFile(1)] });
    expect(mixed.code).toBe(1);
    expect(lines(mixed.stdout).join("\n")).toContain("W2961");
  });
});
