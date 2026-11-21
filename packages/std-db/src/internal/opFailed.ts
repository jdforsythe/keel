/** A failed storage call: names the driver, the operation and the database's own error code, never a value or key. */
export function opFailed(driver: string, op: string, e: unknown): Error {
  const code = typeof e === "object" && e !== null && "code" in e ? e.code : undefined;
  const errcode = typeof e === "object" && e !== null && "errcode" in e ? e.errcode : undefined;
  const tag = typeof errcode === "number" ? `sqlite ${errcode}` : typeof code === "string" ? code : "unknown";
  return new Error(`std.db ${driver}: ${op} failed (${tag})`);
}
