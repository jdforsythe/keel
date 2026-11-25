// k.library In an app: `runCheck` reads a library's files once (`checkInputs` over `libraryProjectFiles`), so `check()`
// gets each of them once in the project and, over every code file, once among the checked files.
import { expect, test } from "vitest";
import { cleanup, materialize, project } from "../conformance/library-support.ts";
import { CODE_FILE } from "../src/internal/CODE_FILE.ts";
import { checkInputs } from "../src/internal/checkInputs.ts";
import type { SourceFile } from "../src/types/SourceFile.ts";

const LIB = "node_modules/@acme/charts/";
const own = (tree: Record<string, string>): SourceFile[] =>
  Object.entries(tree)
    .filter(([p]) => !p.startsWith("node_modules/"))
    .map(([path, source]) => ({ path, source }));
const count = (files: readonly SourceFile[], path: string): number => files.filter((f) => f.path === path).length;

test("a library's files join the project once and, over every code file, the checked files once", () => {
  const tree = project();
  const dir = materialize(tree);
  try {
    const projectFiles = own(tree);
    const code = projectFiles.filter((f) => CODE_FILE.test(f.path));
    const read = checkInputs(dir, code, projectFiles, true);
    const added = read.all.filter((f) => f.path.startsWith(LIB)).map((f) => f.path);
    expect(added.sort()).toEqual(
      ["package.json", "module.ts", ".keel/ledger.json", "src/index.ts", "src/Badge.tsx"].map((p) => LIB + p).sort(),
    );
    expect(new Set(read.all.map((f) => f.path)).size).toBe(read.all.length);
    const checkedLib = read.checked.filter((f) => f.path.startsWith(LIB)).map((f) => f.path);
    expect(checkedLib.sort()).toEqual([`${LIB}module.ts`, `${LIB}src/Badge.tsx`, `${LIB}src/index.ts`]);
    expect(new Set(read.checked.map((f) => f.path)).size).toBe(read.checked.length);

    // A project read that already holds a library file, and checked files that do, gain no second copy.
    const held = { path: `${LIB}package.json`, source: tree[`${LIB}package.json`] ?? "" };
    const badge = { path: `${LIB}src/Badge.tsx`, source: tree[`${LIB}src/Badge.tsx`] ?? "" };
    const again = checkInputs(dir, [...code, badge], [...projectFiles, held], true);
    for (const p of [`${LIB}package.json`, `${LIB}src/Badge.tsx`, `${LIB}module.ts`])
      expect(count(again.all, p)).toBe(1);
    expect(count(again.checked, `${LIB}src/Badge.tsx`)).toBe(1);

    // Some paths only: the libraries join the project, never the checked files.
    expect(checkInputs(dir, code, projectFiles, false).checked).toBe(code);
  } finally {
    cleanup(dir);
  }
});

test("a project whose manifests list no library reads none: its arrays pass through unchanged", () => {
  const tree = project({ deps: [], libraries: [], page: false });
  const dir = materialize(tree);
  try {
    const projectFiles = own(tree);
    const code = projectFiles.filter((f) => CODE_FILE.test(f.path));
    const read = checkInputs(dir, code, projectFiles, true);
    expect(read.all).toBe(projectFiles);
    expect(read.checked).toBe(code);
  } finally {
    cleanup(dir);
  }
});
