import type { Diagnostic } from "../types/Diagnostic.ts";
import { artifactRank } from "./artifactRank.ts";

const cmp = (x: string, y: string): number => (x < y ? -1 : x > y ? 1 : 0);

/** Total order: source diagnostics before stale-artifact ones, then path, line, col, code, message, fix (deterministic output). */
export function compareDiagnostics(a: Diagnostic, b: Diagnostic): number {
  return (
    artifactRank(a.code) - artifactRank(b.code) ||
    cmp(a.path, b.path) ||
    a.line - b.line ||
    a.col - b.col ||
    cmp(a.code, b.code) ||
    cmp(a.message, b.message) ||
    cmp(a.fix ?? "", b.fix ?? "") ||
    cmp(a.see ?? "", b.see ?? "")
  );
}
