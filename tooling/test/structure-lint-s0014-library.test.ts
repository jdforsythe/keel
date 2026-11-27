// Spec: k.unsafe, Unsafe: in a library's package (k.library) the app's reading enforces every lifted code, so a lifted
// range holding a finding of any of them is an escape S0014 accepts; a kernel package's stays E1757 alone.
// The real `tooling/structure-lint.mjs --root <tmp>` runs over a throwaway root; its S0014 findings are read. Fixture
// text is built from constants so this file's own source holds no literal `unsafe(` call.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterAll, describe, expect, it } from "vitest";
import { fixedTime, testTime } from "../test-time.ts";

const lint = path.join(import.meta.dirname, "..", "structure-lint.mjs");
const made: string[] = [];
afterAll(() => {
  for (const d of made) fs.rmSync(d, { recursive: true, force: true });
});

const U = "unsafe";
const REASON = "one two three four five six seven eight";
const THROWS = `export const f = (): never => ${U}("${REASON}", () => {\n  throw new Error("x");\n});\n`;
const PLAIN = `export const f = (): number => ${U}("${REASON}", () => 1);\n`;
const LIBRARY = JSON.stringify({ name: "@x/p", type: "module", keel: "library" });
const KERNEL = JSON.stringify({ name: "@x/p", type: "module" });

/** structure-lint over a throwaway root holding `files`; its S0014 findings. */
function s0014(files: Readonly<Record<string, string>>): { code: string; path: string; line: number }[] {
  const root = tempDir("keel-s0014-lib-");
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
    .filter((d) => d.code === "S0014");
}

describe("k.unsafe S0014 in a library's package", () => {
  it(
    "a lifted range holding a throw (E1451) is no S0014 in a library's package",
    () => {
      expect(s0014({ "packages/p/package.json": LIBRARY, "packages/p/unsafe/a.ts": THROWS })).toEqual([]);
    },
    fixedTime(90_000),
  );

  it(
    "the same range is one S0014 in a kernel package",
    () => {
      expect(s0014({ "packages/p/package.json": KERNEL, "packages/p/unsafe/a.ts": THROWS })).toHaveLength(1);
    },
    fixedTime(90_000),
  );

  it(
    "a lifted range holding no lifted finding is one S0014 in a library's package",
    () => {
      expect(s0014({ "packages/p/package.json": LIBRARY, "packages/p/unsafe/a.ts": PLAIN })).toHaveLength(1);
    },
    fixedTime(90_000),
  );

  it(
    "a finding outside the call's range does not lift it: one S0014 in a library's package",
    () => {
      const source = `${PLAIN}export const g = (): never => {\n  throw new Error("x");\n};\n`;
      expect(s0014({ "packages/p/package.json": LIBRARY, "packages/p/unsafe/a.ts": source })).toHaveLength(1);
    },
    fixedTime(90_000),
  );

  it(
    "two calls, one lifting a finding and one lifting nothing: the second is the one S0014",
    () => {
      const source = `export const f = (): never => ${U}("${REASON}", () => {\n  throw new Error("x");\n});\nexport const g = (): number => ${U}("${REASON}", () => 1);\n`;
      const found = s0014({ "packages/p/package.json": LIBRARY, "packages/p/unsafe/a.ts": source });
      expect(found.map((d) => d.line)).toEqual([4]);
    },
    fixedTime(90_000),
  );
});
