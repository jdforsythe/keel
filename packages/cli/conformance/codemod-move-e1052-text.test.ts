// Spec: k.cli, clause "`keel codemod move OrderCard` is E1052 naming `--to <module>` and a line passing it."
// Seed 1337 (recorded; no generated inputs). Runs in process.
import { describe, expect, it } from "vitest";
import { keel, lines, parseJsonLines } from "./fixtures";

describe("k.cli codemod move", () => {
  it("`keel codemod move OrderCard` is E1052 naming `--to <module>` and a line passing it", async () => {
    const j = await keel(["codemod", "move", "OrderCard", "--format=json"]);
    const diag = parseJsonLines(j.stdout).filter((r) => r.kind === "diag" && r.code === "E1052");
    expect(diag).toHaveLength(1);
    expect(JSON.stringify(diag[0])).toContain("--to <module>");
    const c = await keel(["codemod", "move", "OrderCard"]);
    const all = lines(`${c.stdout}${c.stderr}`);
    expect(all.some((l) => l.includes("E1052") && l.includes("--to <module>"))).toBe(true);
    expect(all.some((l) => l.includes("keel codemod move OrderCard --to"))).toBe(true);
  });
});
