/**
 * The database's own error code of driver error `e`: `sqlite <errcode>` for a numeric `errcode`, else a string `code`
 * (an SQLSTATE or a system error code), else `unknown`; never a value or key.
 */
export function driverCode(e: unknown): string {
  const code = typeof e === "object" && e !== null && "code" in e ? e.code : undefined;
  const errcode = typeof e === "object" && e !== null && "errcode" in e ? e.errcode : undefined;
  return typeof errcode === "number" ? `sqlite ${errcode}` : typeof code === "string" ? code : "unknown";
}
