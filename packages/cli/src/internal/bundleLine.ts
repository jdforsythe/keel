import type { OutRecord } from "../types/OutRecord.ts";

/**
 * A run's record as one bundle `.ndjson` line (k.evidence: no file holds an app value): a diagnostic keeps its code,
 * place and section, its message and fix text left out; other records are kept whole.
 */
export function bundleLine(r: OutRecord): string {
  if (r.kind !== "diag") return JSON.stringify(r);
  const { message: _message, fix: _fix, ...kept } = r;
  return JSON.stringify(kept);
}
