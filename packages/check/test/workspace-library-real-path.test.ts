// k.library Kind: a library in the project's tree is read once only when the project's `node_modules/<name>/` is that
// very folder (a link, by real path); a different copy installed under the same name is another library, both judged.
import { cpSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { tempDir } from "@keel/tooling/test-tmp";
import fc from "fast-check";
import { afterEach, describe, expect, test } from "vitest";
import type { SourceFile } from "../src/index.ts";
import { workspaceLibraries } from "../src/internal/workspaceLibraries.ts";

const PKG = '{"name":"@fx/sup","version":"0.0.0","type":"module","keel":"library"}';
const TOPOLOGY = "import { topology } from '@keel/server'\nexport default topology({})\n";
const LIB = "libs/sup/src/a.ts";
const COPY = "node_modules/@fx/sup/src/a.ts";

/** The project's files as the cli hands them over: the folder and what `node_modules/@fx/sup/` holds. */
const files = (folder: string, installed: string): SourceFile[] => [
  { path: "topology.ts", source: TOPOLOGY },
  { path: "libs/sup/package.json", source: PKG },
  { path: LIB, source: folder },
  { path: "node_modules/@fx/sup/package.json", source: PKG },
  { path: COPY, source: installed },
];

let dir = "";
afterEach(() => {
  if (dir !== "") rmSync(dir, { recursive: true, force: true });
  dir = "";
});
const put = (path: string, source: string): void => {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), source);
};
const onDisk = (): void => {
  dir = tempDir("keel-ws-lib-", realpathSync(tmpdir()));
  put("topology.ts", TOPOLOGY);
  put("libs/sup/package.json", PKG);
  put(LIB, "export const a = 1\n");
};

describe("workspaceLibraries: one library by real path", () => {
  test("`node_modules/@fx/sup` a link to `libs/sup`: the folder's file is read once, through node_modules", () => {
    onDisk();
    mkdirSync(join(dir, "node_modules", "@fx"), { recursive: true });
    symlinkSync(join(dir, "libs", "sup"), join(dir, "node_modules", "@fx", "sup"));
    const ws = workspaceLibraries(files("export const a = 1\n", "export const a = 1\n"), dir);
    expect(ws.twin(LIB)).toBe(true);
    expect(ws.inPlace(LIB)).toBe(false);
  });

  test("`node_modules/@fx/sup` another copy under the same name, its text equal too: both are judged", () => {
    onDisk();
    cpSync(join(dir, "libs", "sup"), join(dir, "node_modules", "@fx", "sup"), { recursive: true });
    const ws = workspaceLibraries(files("export const a = 1\n", "export const a = 1\n"), dir);
    expect(ws.twin(LIB)).toBe(false);
    expect(ws.inPlace(LIB)).toBe(true);
  });

  test("given in memory only, the two are one library exactly when every file's text is equal", () => {
    const nowhere = join(realpathSync(tmpdir()), "keel-ws-lib-absent", String(process.pid));
    fc.assert(
      fc.property(fc.string(), fc.string(), (a, b) => {
        const ws = workspaceLibraries(files(a, b), nowhere);
        expect(ws.twin(LIB)).toBe(a === b);
        expect(ws.inPlace(LIB)).toBe(a !== b);
      }),
      { seed: 1337, numRuns: 100 },
    );
    const same = workspaceLibraries(files("x", "x"), nowhere);
    expect(same.twin(LIB)).toBe(true);
  });
});
