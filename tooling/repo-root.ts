// The repository root for tests that spawn the CLI, scan packages/ or apps/, or import a sibling package by path.
// Stryker runs tests from a copy of the package under `<package>/.stryker-tmp/sandbox-*`, where a path relative to the
// test file reaches no sibling package; the directory holding `pnpm-workspace.yaml` is above the sandbox as well as
// above the package, so walking up from the test file finds the real root from either place.
import fs from "node:fs";
import path from "node:path";

/** The nearest ancestor of `from` (a directory, usually `import.meta.dirname`) that holds `pnpm-workspace.yaml`. */
export function repoRoot(from: string): string {
  let dir = path.resolve(from);
  for (;;) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`no pnpm-workspace.yaml above ${from}`);
    dir = parent;
  }
}
