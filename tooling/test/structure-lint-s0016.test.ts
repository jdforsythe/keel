// S0016: a hard-coded time in test code (hard-times.mjs judges the source; this file checks structure-lint's file set
// and the conformance list).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterAll, describe, expect, it } from "vitest";
import { hardTimes } from "../hard-times.mjs";
import { fixedTime, testTime } from "../test-time.ts";

const lint = path.join(import.meta.dirname, "..", "structure-lint.mjs");
const made: string[] = [];
afterAll(() => {
  for (const d of made) fs.rmSync(d, { recursive: true, force: true });
});

/** Runs structure-lint over a throwaway root holding `files`; returns its S0016 diagnostics. */
function s0016(files: Record<string, string>): { code: string; path: string; line: number; message: string }[] {
  const root = tempDir("keel-s0016-");
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
    .filter((d) => d.code === "S0016");
}

const lines = (source: string): number[] => hardTimes(source, "a.test.ts").map((d: { line: number }) => d.line);

describe("hardTimes", () => {
  it("finds a bare time at a timeout property, AbortSignal.timeout, a time-named variable or default, and a deadline", () => {
    const source = [
      `spawnSync("x", [], { timeout: 60_000 });`,
      "fetch(u, { signal: AbortSignal.timeout(5_000) });",
      "const LIMIT_MS = 240_000;",
      "async function up(url, ms = 20_000) {}",
      "const end = Date.now() + 10_000;",
      "const stepTimeout = 2 * 1000;",
    ].join("\n");
    expect(lines(source)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("passes a time through testTime or fixedTime, a small factor, an instant, and a name that is not a time", () => {
    const source = [
      `spawnSync("x", [], { timeout: testTime(60_000) });`,
      "const LEASE_MS = fixedTime(30_000);",
      "const LIMIT_MS = 2 * testTime(T);",
      "const MIN_MS = -62135596800000;",
      "const count = 50_000;",
      "const end = Date.now() + testTime(10_000);",
    ].join("\n");
    expect(lines(source)).toEqual([]);
  });

  it("finds a bare number in a vitest call's bound: after the callback, in options, in a hook, in a const it reads", () => {
    const source = [
      `import { beforeAll, describe, it } from "vitest";`,
      "const SLOW_MS = 60_000;",
      "const LIMIT = 90_000;",
      `describe("d", { timeout: SLOW_MS }, () => {});`,
      `it("a", { timeout: 30_000 }, () => {});`,
      `it("b", () => {}, 2 * 15_000);`,
      `it("c", () => {}, LIMIT);`,
      "beforeAll(() => {}, 20_000);",
      `it("d", () => {}, 9);`,
    ].join("\n");
    expect(lines(source)).toEqual([2, 3, 5, 6, 8, 9]);
  });

  it("passes a bound that goes through a helper, however it is named, held or combined", () => {
    const source = [
      `import { it } from "vitest";`,
      `import { SLOW } from "./bounds.ts";`,
      "const COLD = fixedTime(15_000);",
      "const RUNS = 100;",
      `it("a", () => {}, COLD);`,
      `it("b", () => {}, SLOW);`,
      `it("c", { timeout: 2 * COLD + testTime(500) }, () => {});`,
      `it("d", { timeout: RUNS * 50 }, () => {});`,
      `it("e", () => {}, fixedTime(10_000) + testTime(20_000));`,
    ].join("\n");
    expect(lines(source)).toEqual([]);
  });
});

// Each case runs structure-lint over a throwaway root, a process of its own: about 0.6 s here, so 20 s.
describe("S0016 in structure-lint's file set", { timeout: fixedTime(20_000) }, () => {
  const hard = `import { spawnSync } from "node:child_process";\nspawnSync("x", [], { timeout: 60_000 });\n`;

  it("is one S0016 in a package test, a tooling smoke and an app's test folder, and none in a package's source", () => {
    const d = s0016({
      "packages/a/test/t.test.ts": hard,
      "tooling/smoke/s.mjs": hard,
      "apps/b/test/support.ts": hard,
      "packages/a/src/run.ts": hard,
    });
    expect(d.map((x) => [x.path, x.line]).sort()).toEqual([
      ["apps/b/test/support.ts", 2],
      ["packages/a/test/t.test.ts", 2],
      ["tooling/smoke/s.mjs", 2],
    ]);
  });

  it("passes a conformance time listed in hard-times-conformance.json, and refuses one not listed", () => {
    const list = [{ path: "packages/a/conformance/c.test.ts", line: 2, text: "60_000", needs: "fixedTime" }];
    expect(
      s0016({ "packages/a/conformance/c.test.ts": hard, "tooling/hard-times-conformance.json": JSON.stringify(list) }),
    ).toEqual([]);
    expect(s0016({ "packages/a/conformance/c.test.ts": hard }).map((x) => x.path)).toEqual([
      "packages/a/conformance/c.test.ts",
    ]);
  });

  it("refuses a listed time that is no longer in its file, so the list only shrinks", () => {
    const list = [{ path: "packages/a/conformance/c.test.ts", line: 2, text: "60_000", needs: "testTime" }];
    const d = s0016({
      "packages/a/conformance/c.test.ts": "export {};\n",
      "tooling/hard-times-conformance.json": JSON.stringify(list),
    });
    expect(d.map((x) => x.message)).toEqual([
      "60_000 is listed in hard-times-conformance.json and no longer in the file",
    ]);
  });
});
