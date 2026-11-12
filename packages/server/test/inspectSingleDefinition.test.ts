// The inspect endpoint's shared constants have one definition (red-team 0071): `@keel/compiler/inspect/*`, imported by
// the dev server. A second literal anywhere under packages/*/src is a duplicate to delete.
import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "@keel/tooling/repo-root";
import { describe, expect, it } from "vitest";

const PACKAGES = path.join(repoRoot(import.meta.dirname), "packages");

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" || e.name.startsWith(".") ? [] : sources(full);
    return e.name.endsWith(".ts") ? [full] : [];
  });
}

const files = fs
  .readdirSync(PACKAGES)
  .flatMap((p) => (fs.existsSync(path.join(PACKAGES, p, "src")) ? sources(path.join(PACKAGES, p, "src")) : []));

const defining = (pattern: RegExp): string[] =>
  files.filter((f) => pattern.test(fs.readFileSync(f, "utf8"))).map((f) => path.relative(PACKAGES, f));

describe("inspect constants are defined once", () => {
  it("the /__keel/inspect path literal in src is in compiler/src/inspect/INSPECT_PATH.ts only, plus doc comments and the cli client", () => {
    expect(defining(/(?:const|let)\s+INSPECT_PATH\b/)).toEqual(["compiler/src/inspect/INSPECT_PATH.ts"]);
    expect(defining(/=\s*"\/__keel\/inspect"/)).toEqual(["compiler/src/inspect/INSPECT_PATH.ts"]);
  });

  it("the loopback host set and the origin matcher likewise", () => {
    expect(defining(/(?:const|let)\s+LOOPBACK\b/)).toEqual(["compiler/src/inspect/LOOPBACK.ts"]);
    expect(defining(/new Set\(\["localhost", "127\.0\.0\.1"/)).toEqual(["compiler/src/inspect/LOOPBACK.ts"]);
    expect(defining(/function (?:originListed|originMatches)\b|const (?:listed|originMatches)\s*=/)).toEqual([
      "compiler/src/inspect/originListed.ts",
    ]);
  });
});
