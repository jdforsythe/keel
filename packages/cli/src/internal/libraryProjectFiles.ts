import { existsSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { projectDirs } from "@keel/compiler";
import { libraryFiles } from "@keel/compiler/std/libraryFiles";
import type { SourceFile } from "../types/SourceFile.ts";
import { CODE_FILE } from "./CODE_FILE.ts";

/**
 * Binary only: the files of each library the projects of `files` (paths relative to `cwd`) reach (`libraryFiles`, kind
 * `library`; k.library In an app), read from the library's real folder and placed at `<p>node_modules/<name>/`, `<p>`
 * the project dir whose manifests list it: its `package.json`, its root `module.ts` and the code files under its `src/`
 * and `unsafe/`. None for a project without libraries.
 */
export function libraryProjectFiles(cwd: string, files: readonly SourceFile[]): SourceFile[] {
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
        const rel = relative(lib.dir, abs).split(sep).join("/");
        if (!out.has(`${at}${rel}`) && existsSync(abs)) out.set(`${at}${rel}`, readFileSync(abs, "utf8"));
      };
      add(join(lib.dir, "package.json"));
      if (lib.manifest !== undefined) out.set(`${at}module.ts`, lib.manifest);
      for (const f of lib.files) if (CODE_FILE.test(f)) add(f);
    }
  }
  return [...out].map(([path, source]) => ({ path, source }));
}
