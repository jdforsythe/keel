import type { Program } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import { parseFile } from "./parseFile.ts";

/** The files of `project` under `dir` that parse, with paths relative to `dir`, and their programs. */
export function dirPrograms(dir: string, project: readonly SourceFile[]): { path: string; program: Program }[] {
  return project.flatMap((f) => {
    const p = f.path.startsWith(dir) ? parseFile(f) : undefined;
    return p?.ok === true ? [{ path: f.path.slice(dir.length), program: p.program }] : [];
  });
}
