import { DB_CLASSES } from "./DB_CLASSES.ts";

type DbClass = (typeof DB_CLASSES)[number];
const CLASSES: ReadonlyMap<string, DbClass> = new Map(DB_CLASSES.map((c) => [c, c]));

/**
 * What `db.failed` carries of driver error `e` (std.db), closed: for a numeric `errcode`, class `sqlite` and that
 * code; for a string `code` that is an SQLSTATE of a listed class, that class; for one like `ECONNREFUSED`, `system`;
 * else `unknown`. `errcode` is `0` but for SQLite. Never a value, a key or the error's text.
 */
export function driverFault(e: unknown): { readonly class: DbClass; readonly errcode: number } {
  const code = typeof e === "object" && e !== null && "code" in e ? e.code : undefined;
  const errcode = typeof e === "object" && e !== null && "errcode" in e ? e.errcode : undefined;
  if (typeof errcode === "number") return { class: "sqlite", errcode };
  if (typeof code !== "string") return { class: "unknown", errcode: 0 };
  const sqlClass = /^[0-9A-Z]{5}$/.test(code) ? CLASSES.get(code.slice(0, 2)) : undefined;
  if (sqlClass !== undefined) return { class: sqlClass, errcode: 0 };
  return { class: /^E[A-Z0-9_]+$/.test(code) ? "system" : "unknown", errcode: 0 };
}
