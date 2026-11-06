import type { Diagnostic } from "../types/Diagnostic.ts";
import { compareDiagnostics } from "./compareDiagnostics.ts";

/**
 * Canonical diagnostics: fields in the fixed order (kind, code, path, line, col, message, see, fix; absent
 * optionals omitted), identical ones deduplicated, sorted by path, line, col (k.check step 5).
 */
export function normalize(diags: readonly Diagnostic[]): Diagnostic[] {
  const seen = new Set<string>();
  const out: Diagnostic[] = [];
  for (const d of diags) {
    const base = { kind: "diag", code: d.code, path: d.path, line: d.line, col: d.col, message: d.message } as const;
    const withSee = d.see === undefined ? base : { ...base, see: d.see };
    const c: Diagnostic = d.fix === undefined ? withSee : { ...withSee, fix: d.fix };
    const key = JSON.stringify(c);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out.sort(compareDiagnostics);
}
