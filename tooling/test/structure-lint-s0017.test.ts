// S0017 over structure-lint's file set: a property case in a folder whose vitest config is not keelConfig states its
// own timeout (property-times.ts judges the test; this file checks the folders it is applied to).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { fixedTime, testTime } from "../test-time.ts";

const lint = path.join(import.meta.dirname, "..", "structure-lint.mjs");
const made: string[] = [];
afterAll(() => {
  for (const d of made) fs.rmSync(d, { recursive: true, force: true });
});

/** Runs structure-lint over a throwaway root holding `files`; returns its S0017 diagnostics. */
function s0017(files: Record<string, string>): { code: string; path: string; line: number }[] {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "keel-s0017-"));
  made.push(root);
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
    .filter((d) => d.code === "S0017");
}

const untimed =
  "import { properties } from '@keel/testing';\nimport { it } from 'vitest';\nimport P from './P.ts';\n\nit('p', async () => {\n  await properties(P, { runs: 100, seed: 1 });\n});\n";
const timed =
  "import { properties } from '@keel/testing';\nimport { it } from 'vitest';\nimport P from './P.ts';\n\nit('p', { timeout: 30_000 }, async () => {\n  await properties(P, { runs: 100, seed: 1 });\n});\n";
const fastCheck =
  "import fc from 'fast-check';\nimport { it } from 'vitest';\nit('p', () => {\n  fc.assert(fc.property(fc.nat(), () => true), { seed: 1, numRuns: 200 });\n});\n";
const ownConfig = "import { defineConfig } from 'vitest/config';\nexport default defineConfig({ test: {} });\n";
const keelConfigured =
  "import { keelConfig } from '@keel/tooling/vitest-config';\nexport default keelConfig({ test: {} });\n";

// Each case runs structure-lint over a throwaway root, a process of its own: about 0.6 s here, so 20 s.
describe("S0017 in structure-lint's file set", { timeout: fixedTime(20_000) }, () => {
  it("an untimed properties test in a library with its own vitest config is one S0017 at its line", () => {
    const d = s0017({ "libraries/x/vitest.config.ts": ownConfig, "libraries/x/test/p.test.ts": untimed });
    expect(d.map((x) => [x.path, x.line])).toEqual([["libraries/x/test/p.test.ts", 5]]);
  });

  it("an untimed fast-check assert in an example with no vitest config is one S0017", () => {
    expect(s0017({ "examples/x/test/p.test.ts": fastCheck })).toHaveLength(1);
  });

  it("the same test with its own timeout passes", () => {
    expect(s0017({ "libraries/x/vitest.config.ts": ownConfig, "libraries/x/test/p.test.ts": timed })).toEqual([]);
  });

  it("an untimed test under keelConfig passes: the property-time transform times it", () => {
    expect(s0017({ "apps/x/vitest.config.ts": keelConfigured, "apps/x/test/p.test.ts": untimed })).toEqual([]);
  });
});
