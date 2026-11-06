import type { OutRecord } from "../types/OutRecord.ts";
import { USAGE_CODES } from "./USAGE_CODES.ts";
import { isError } from "./isError.ts";

/**
 * 2 on a usage error; 1 on any other error diagnostic or a failing summary (failed tests report T0001, a
 * tooling code, and fail through their summary); else 0 (k.cli Output). Computed before `--code` filtering.
 */
export function exitCode(records: readonly OutRecord[]): number {
  if (records.some((r) => r.kind === "diag" && typeof r.code === "string" && USAGE_CODES.has(r.code))) return 2;
  return records.some((r) => isError(r) || (r.kind === "summary" && r.ok === false)) ? 1 : 0;
}
