import type { DbFailed } from "./DbFailed.ts";

/**
 * A failed storage call (the `expect` of every std.db `attempt` over a driver): names the driver, the operation and
 * the database's own error code, never a value or key.
 */
export function opFailed(driver: string, op: string, e: unknown): DbFailed {
  const code = typeof e === "object" && e !== null && "code" in e ? e.code : undefined;
  const errcode = typeof e === "object" && e !== null && "errcode" in e ? e.errcode : undefined;
  const tag = typeof errcode === "number" ? `sqlite ${errcode}` : typeof code === "string" ? code : "unknown";
  return { code: "db.failed", message: `std.db ${driver}: ${op} failed (${tag})`, data: null };
}
