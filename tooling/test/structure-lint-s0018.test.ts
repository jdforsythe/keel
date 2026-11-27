// S0018: a raw `mkdtemp` in test code. raw-temp-dirs.mjs judges the source; the second block runs structure-lint over a
// throwaway root to check which files it is applied to.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { rawTempDirs } from "../raw-temp-dirs.mjs";
import { fixedTime, testTime } from "../test-time.ts";
import { tempDir } from "../test-tmp.ts";

const lint = path.join(import.meta.dirname, "..", "structure-lint.mjs");
const lines = (source: string): number[] => rawTempDirs(source, "a.test.ts").map((d: { line: number }) => d.line);

describe("rawTempDirs", () => {
  it("finds a bare, a member and an awaited call at their lines", () => {
    const src = [
      "import fs from 'node:fs';",
      "const a = mkdtempSync('x-');",
      "const b = fs.mkdtempSync('x-');",
      "const c = await fsp.mkdtemp('x-');",
    ].join("\n");
    expect(lines(src)).toEqual([2, 3, 4]);
  });

  it("passes tempDir, a string that names mkdtemp and a property that only shares a prefix", () => {
    const src =
      "const a = tempDir('x-');\nconst s = 'mkdtempSync(';\nconst o = { mkdtempSyncLike() {} };\no.mkdtempSyncLike();\n";
    expect(lines(src)).toEqual([]);
  });
});

/** Runs structure-lint over a throwaway root holding `files`; returns its S0018 diagnostics. */
function s0018(files: Record<string, string>): { path: string; line: number }[] {
  const root = tempDir("keel-s0018-");
  for (const [file, source] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), source);
  }
  const r = spawnSync(process.execPath, [lint, "--root", root, "--format=json"], {
    encoding: "utf8",
    timeout: testTime(60_000),
  });
  return r.stdout
    .split("\n")
    .filter((l) => l.startsWith("{"))
    .map((l) => JSON.parse(l))
    .filter((d) => d.code === "S0018");
}

const raw =
  "import { mkdtempSync } from 'node:fs';\nimport { tmpdir } from 'node:os';\nmkdtempSync(tmpdir() + '/x-');\n";

// Each case runs structure-lint over a throwaway root, a process of its own: about 0.6 s here, so 20 s.
describe("S0018 in structure-lint's file set", { timeout: fixedTime(20_000) }, () => {
  it("a raw mkdtemp in a package's test file is one S0018 at its line", () => {
    expect(s0018({ "packages/x/test/a.test.ts": raw }).map((d) => [d.path, d.line])).toEqual([
      ["packages/x/test/a.test.ts", 3],
    ]);
  });

  it("one in a tooling test and one in an app's test file are refused", () => {
    expect(s0018({ "tooling/test/a.test.ts": raw, "apps/x/test/b.test.ts": raw })).toHaveLength(2);
  });

  it("one in a conformance file is not judged", () => {
    expect(s0018({ "packages/x/conformance/a.test.ts": raw })).toEqual([]);
  });
});
