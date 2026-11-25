import { existsSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { projectDirs } from "@keel/compiler";
import { libraryFiles } from "@keel/compiler/std/libraryFiles";
import type { SourceFile } from "../types/SourceFile.ts";
import { CODE_FILE } from "./CODE_FILE.ts";

/**
 * The files of the libraries (kind `library`, k.library In an app) each project of `files` reaches, read from each
 * library's real folder and placed at `<p>node_modules/<name>/`, `<p>` the project dir whose manifests list it: its
 * `package.json`, root `module.ts`, `.keel/ledger.json` and the code files under its `src/` and `unsafe/`. A path
 * `files` already holds is left out. `keel check` adds them to the project it reads (E1162, k.library Rules).
 */
export function libraryProjectFiles(cwd: string, files: readonly SourceFile[]): SourceFile[] {
  const have = new Set(files.map((f) => f.path));
  const out = new Map<string, string>();
  const dirs = projectDirs(files);
  for (const dir of dirs) {
    const own = files
      .filter((f) => f.path.startsWith(dir) && dirs.find((d) => f.path.startsWith(d)) === dir)
      .map((f) => ({ path: f.path.slice(dir.length), source: f.source }));
    for (const lib of libraryFiles(join(cwd, dir), own)) {
      if (lib.kind !== "library") continue;
      const at = `${dir}node_modules/${lib.name}/`;
      const add = (abs: string): void => {
        const path = `${at}${relative(lib.dir, abs).split(sep).join("/")}`;
        if (!have.has(path) && !out.has(path) && existsSync(abs)) out.set(path, readFileSync(abs, "utf8"));
      };
      add(join(lib.dir, "package.json"));
      if (lib.manifest !== undefined && !have.has(`${at}module.ts`)) out.set(`${at}module.ts`, lib.manifest);
      add(join(lib.dir, ".keel", "ledger.json"));
      for (const f of lib.files) if (CODE_FILE.test(f)) add(f);
    }
  }
  return [...out].map(([path, source]) => ({ path, source }));
}
