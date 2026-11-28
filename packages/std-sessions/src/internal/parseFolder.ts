import type { SourceFile } from "@keel/check";
import type { ParsedFile } from "./ParsedFile.ts";
import { parseTs } from "./parseTs.ts";
import { scopeOf } from "./scopeOf.ts";

/** Parses the `.ts` project files under `folder` (a path prefix such as `modules/cart/`); skips syntax errors. */
export function parseFolder(project: readonly SourceFile[], folder: string): ParsedFile[] {
  const out: ParsedFile[] = [];
  for (const f of project) {
    if (!f.path.startsWith(folder) || !f.path.endsWith(".ts")) continue;
    const program = parseTs(f.path, f.source);
    if (program !== undefined) out.push({ path: f.path, program, scope: scopeOf(f.path, program, project) });
  }
  return out;
}
