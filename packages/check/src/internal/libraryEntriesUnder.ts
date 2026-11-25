import type { SourceFile } from "../types/SourceFile.ts";
import { projectLibraries } from "./projectLibraries.ts";

/** The library entries of `project` (`projectLibraries`) whose source lies under `dir`, paths relative to it. */
export function libraryEntriesUnder(dir: string, project: readonly SourceFile[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [spec, at] of projectLibraries.get(project)?.entries ?? [])
    if (at.startsWith(dir)) out[spec] = at.slice(dir.length);
  return out;
}
