// S0015 over structure-lint's file set: a fast-check run with no seed is refused in a conformance folder as in any
// package folder (unseeded-properties.mjs judges the call; this file checks the set it is given).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { testTime } from "../test-time.ts";

const lint = path.join(import.meta.dirname, "..", "structure-lint.mjs");
const made: string[] = [];
afterAll(() => {
  for (const d of made) fs.rmSync(d, { recursive: true, force: true });
});

/** Runs structure-lint over a throwaway root holding one file; returns its S0015 diagnostics. */
function s0015(file: string, source: string): { code: string; path: string; line: number }[] {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "keel-s0015-"));
  made.push(root);
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), source);
  const r = spawnSync(process.execPath, [lint, "--root", root, "--format=json"], {
    encoding: "utf8",
    timeout: testTime(60_000),
  });
  return r.stdout
    .split("\n")
    .filter((l) => l.startsWith("{"))
    .map((l) => JSON.parse(l))
    .filter((d) => d.code === "S0015");
}

const unseeded =
  "import fc from 'fast-check';\nimport { it } from 'vitest';\nit('p', () => {\n  fc.assert(fc.property(fc.nat(), () => true));\n});\n";
const seeded =
  "import fc from 'fast-check';\nimport { it } from 'vitest';\nit('p', () => {\n  fc.assert(fc.property(fc.nat(), () => true), { seed: 1 });\n});\n";

describe("S0015 in structure-lint's file set", () => {
  it("an unseeded property in `packages/a/conformance/` is one S0015 at its line", () => {
    const d = s0015("packages/a/conformance/p.test.ts", unseeded);
    expect(d.map((x) => [x.path, x.line])).toEqual([["packages/a/conformance/p.test.ts", 4]]);
  });

  it("the same property seeded in `packages/a/conformance/` passes", () => {
    expect(s0015("packages/a/conformance/p.test.ts", seeded)).toEqual([]);
  });

  it("an unseeded property in `packages/a/test/` is one S0015", () => {
    expect(s0015("packages/a/test/p.test.ts", unseeded)).toHaveLength(1);
  });
});
