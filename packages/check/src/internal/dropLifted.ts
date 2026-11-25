import type { Diagnostic } from "../types/Diagnostic.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import { LIBRARY_LIFTED_CODES } from "./LIBRARY_LIFTED_CODES.ts";
import { LIFTED_CODES } from "./LIFTED_CODES.ts";
import { liftedRanges } from "./liftedRanges.ts";

/** Offset of 1-based `line`, `col` in `source` (UTF-16, the compiler's convention). */
function offsetOf(source: string, line: number, col: number): number {
  let at = 0;
  for (let l = 1; l < line; l++) {
    const nl = source.indexOf("\n", at);
    if (nl === -1) return source.length;
    at = nl + 1;
  }
  return at + col - 1;
}

/**
 * `diags` without the findings of a lifted code that lie in a lifted range of a file under `unsafe/`, and of a
 * library's lifted code in a library's file (under `node_modules/`).
 */
export function dropLifted(diags: readonly Diagnostic[], files: readonly SourceFile[]): Diagnostic[] {
  const ranges = new Map<string, readonly (readonly [number, number])[]>();
  const sources = new Map<string, string>();
  for (const f of files) sources.set(f.path, f.source);
  return diags.filter((d) => {
    const lifts = LIFTED_CODES.has(d.code) || (LIBRARY_LIFTED_CODES.has(d.code) && /(?:^|\/)node_modules\//.test(d.path));
    if (!lifts || !/(?:^|\/)unsafe\//.test(d.path)) return true;
    const source = sources.get(d.path);
    const file = files.find((f) => f.path === d.path);
    if (source === undefined || file === undefined) return true;
    let mine = ranges.get(d.path);
    if (mine === undefined) {
      mine = liftedRanges(file);
      ranges.set(d.path, mine);
    }
    const at = offsetOf(source, d.line, d.col);
    return !mine.some(([start, end]) => at >= start && at < end);
  });
}
