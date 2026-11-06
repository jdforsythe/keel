import type { OutRecord } from "../types/OutRecord.ts";

/** An error diagnostic: a `diag` record whose code starts with E. Only these affect the exit code (k.check). */
export function isError(r: OutRecord): boolean {
  return r.kind === "diag" && typeof r.code === "string" && r.code.startsWith("E");
}
