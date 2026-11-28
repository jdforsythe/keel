import { join } from "node:path";
import { projectDirs } from "@keel/compiler";
import { libraryFiles } from "@keel/compiler/std/libraryFiles";
import type { SourceFile } from "../types/SourceFile.ts";

/**
 * The root manifest of each library (`libraryFiles`, either kind) each project of `files` reaches, at
 * `<p>node_modules/<name>/module.ts`, `<p>` the project dir whose manifests list it; a path `files` already holds is
 * left out. The deploy files read a library's `env` there (k.server-deps Environment).
 */
export function libraryManifestFiles(cwd: string, files: readonly SourceFile[]): SourceFile[] {
  const have = new Set(files.map((f) => f.path));
  const out = new Map<string, string>();
  const dirs = projectDirs(files);
  for (const dir of dirs) {
    const own = files
      .filter((f) => f.path.startsWith(dir) && dirs.find((d) => f.path.startsWith(d)) === dir)
      .map((f) => ({ path: f.path.slice(dir.length), source: f.source }));
    for (const lib of libraryFiles(join(cwd, dir), own)) {
      const path = `${dir}node_modules/${lib.name}/module.ts`;
      if (lib.manifest !== undefined && !have.has(path)) out.set(path, lib.manifest);
    }
  }
  return [...out].map(([path, source]) => ({ path, source }));
}
