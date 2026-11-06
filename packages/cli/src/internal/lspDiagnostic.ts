import type { Diag } from "./Diag.ts";

/** A check diagnostic as an LSP Diagnostic (0-based positions; severity E=1, W=2, I=3). */
export function lspDiagnostic(d: Diag): Record<string, unknown> {
  const pos = { line: Math.max(0, (d.line ?? 1) - 1), character: Math.max(0, (d.col ?? 1) - 1) };
  const severity = d.code.startsWith("E") ? 1 : d.code.startsWith("W") ? 2 : 3;
  return { range: { start: pos, end: pos }, severity, code: d.code, source: "keel", message: d.message };
}
