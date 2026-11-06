// The golden apps are the repo's own proof: `keel check` over apps/golden-1 reports nothing.
import { readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { run } from "../src/index.ts";

// Repo root via a workspace link, so this also holds in Stryker's sandbox copy (where ../../.. is not the repo root).
const PACKAGES = dirname(realpathSync(join(import.meta.dirname, "..", "node_modules", "@keel", "schema")));
const ROOT = join(PACKAGES, "..", "apps", "golden-1");
const SKIP = new Set(["node_modules", "dist", ".keel", "coverage"]);

function read(dir: string): { path: string; source: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const abs = join(dir, e.name);
    if (e.isDirectory()) return SKIP.has(e.name) ? [] : read(abs);
    // Build config (vite/vitest/stryker) is tooling, outside `keel check`'s scope, as in readProject.
    const code = /\.[cm]?[jt]sx?$/.test(e.name) && !/^(?:vite|vitest|stryker)\.config\./.test(e.name);
    return code ? [{ path: relative(ROOT, abs), source: readFileSync(abs, "utf8") }] : [];
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
