import type { SourceFile } from "./types/SourceFile.ts";

const TOPOLOGY = /^((?:.*\/)?)topology\.ts$/;
const ARTIFACT = /^((?:.*\/)?)\.keel\/[^/]+\.json$/;
const DEFAULT_EXPORT = /^\s*export\s+default\b/m;

/**
 * The project roots among root-relative `files`, deepest first so the first prefix match is a file's own project:
 * `""` and each dir holding a `.keel/` artifact or a `topology.ts` with a default export, readable or not (a file
 * of that name with none, a library's own source, is not a topology), unless the dir has a `modules` segment: module
 * code is never a project root, so a `topology.ts` under `modules/` cannot move files out of their module. The one rule `check()` (one compile per project) and `keel build` (only the root project's files) share.
 */
export function projectDirs(files: readonly SourceFile[]): string[] {
  const dirs = new Set<string>([""]);
  for (const f of files) {
    const top = TOPOLOGY.exec(f.path)?.[1];
    const dir = top !== undefined && DEFAULT_EXPORT.test(f.source) ? top : ARTIFACT.exec(f.path)?.[1];
    if (dir !== undefined && !dir.split("/").includes("modules")) dirs.add(dir);
  }
  return [...dirs].sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
}
