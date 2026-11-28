/**
 * Whether thrown value `e` is a storage driver's failure, which std.db claims as `db.failed`: an `Error` (each driver
 * throws one), or an object carrying a string `code` or a numeric `errcode`. Any other value passes on as thrown.
 */
export function isDriverFailure(e: unknown): boolean {
  if (e instanceof Error) return true;
  if (typeof e !== "object" || e === null) return false;
  const code: unknown = "code" in e ? e.code : undefined;
  const errcode: unknown = "errcode" in e ? e.errcode : undefined;
  return typeof code === "string" || typeof errcode === "number";
}
