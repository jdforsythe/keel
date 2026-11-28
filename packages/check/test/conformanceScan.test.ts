// The conformance scan behind "every Rules code check() does not report is asserted by another package's conformance"
// (explain-and-fixture-per-code.test.ts). A std-sessions disk fixture links back to its own package from
// `conformance/.tmp-<pid>-<n>/node_modules/@keel/std-sessions`; a scan that follows it walked every stale copy inside
// every copy and ran the worker out of heap after 716 green tests. No random inputs (seed 1337 unused).
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterAll, expect, test } from "vitest";
import { sourceFilesUnder } from "../conformance/support.ts";

const root = tempDir("keel-scan-");
afterAll(() => rmSync(root, { recursive: true, force: true }));

/** A package whose conformance holds `copies` disk fixtures, each linking back to the package. */
function packageWithLoops(copies: number): URL {
  const pkg = join(root, `pkg-${copies}`);
  const conf = join(pkg, "conformance");
  mkdirSync(join(conf, "sub"), { recursive: true });
  writeFileSync(join(conf, "a.test.ts"), "expect(code).toBe('E2001')\n");
  writeFileSync(join(conf, "sub", "b.tsx"), "export const b = 1\n");
  writeFileSync(join(conf, "notes.md"), "E2002\n");
  for (let i = 0; i < copies; i++) {
    const copy = join(conf, `.tmp-${i}-0`);
    mkdirSync(join(copy, "node_modules", "@keel"), { recursive: true });
    writeFileSync(join(copy, "topology.ts"), "export default {}\n");
    symlinkSync(pkg, join(copy, "node_modules", "@keel", "pkg"), "dir");
  }
  symlinkSync(join(conf, "sub"), join(conf, "linked"), "dir");
  return pathToFileURL(`${conf}/`);
}

test("the scan lists each source once and never follows a link, node_modules or a dot directory", () => {
  for (const copies of [0, 1, 15]) {
    expect(sourceFilesUnder(packageWithLoops(copies))).toEqual(["a.test.ts", "sub/b.tsx"]);
  }
});

test("a package without conformance scans as empty; a file in its place too", () => {
  expect(sourceFilesUnder(pathToFileURL(join(root, "none", "conformance/")))).toEqual([]);
  writeFileSync(join(root, "file"), "");
  expect(sourceFilesUnder(pathToFileURL(join(root, "file", "conformance/")))).toEqual([]);
});
