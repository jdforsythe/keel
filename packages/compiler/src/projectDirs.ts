import { parseTopology } from "./internal/parseTopology.ts";
import type { SourceFile } from "./types/SourceFile.ts";

const TOPOLOGY = /^((?:.*\/)?)topology\.ts$/;
const ARTIFACT = /^((?:.*\/)?)\.keel\/[^/]+\.json$/;

/**
 * The project roots among root-relative `files` (rfc:0059), deepest first so the first prefix match is a file's own
 * project: `""` and each dir holding a `.keel/` artifact or a `topology.ts` that parses as one, unless the dir has a
 * `modules` segment: module code is never a project root (backlog 0169), so a `topology.ts` under `modules/` cannot
 * move files out of their module. The one rule `check()` (one compile per project) and `keel build` (only the root
 * project's files) share.
 */
export function projectDirs(files: readonly SourceFile[]): string[] {
  const dirs = new Set<string>([""]);
  for (const f of files) {
    const top = TOPOLOGY.exec(f.path)?.[1];
    const dir = top !== undefined && parseTopology(f.source).problems.length === 0 ? top : ARTIFACT.exec(f.path)?.[1];
    if (dir !== undefined && !dir.split("/").includes("modules")) dirs.add(dir);
  }
  return [...dirs].sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
}
