// The golden apps are the repo's own proof: `keel check` over apps/golden-1 reports nothing.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { run } from "../src/index.ts";

const ROOT = join(import.meta.dirname, "..", "..", "..", "apps", "golden-1");
const SKIP = new Set(["node_modules", "dist", ".keel", "coverage"]);

function read(dir: string): { path: string; source: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const abs = join(dir, e.name);
    if (e.isDirectory()) return SKIP.has(e.name) ? [] : read(abs);
    return /\.[cm]?[jt]sx?$/.test(e.name) ? [{ path: relative(ROOT, abs), source: readFileSync(abs, "utf8") }] : [];
  });
}

describe("golden-1", () => {
  it("keel check reports no diagnostics", async () => {
    const r = await run(["check", "--format=json"], { cwd: ROOT, files: read(ROOT) });
    const diags = r.stdout.split("\n").filter((l) => l.includes('"kind":"diag"'));
    expect(diags).toEqual([]);
    expect(r.code).toBe(0);
  });
});
