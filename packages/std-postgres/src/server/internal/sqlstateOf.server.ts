import { SQLSTATES } from "../../internal/SQLSTATES.ts";

const LISTED: ReadonlySet<string> = new Set(SQLSTATES);
/** The classes `postgres.database` takes whole (std.postgres-errors). */
const CLASS = /^(?:22|40|53|54|55|57|P0)[0-9A-Z]{3}$/;

/**
 * The SQLSTATE `postgres.database` carries for driver code `code`: the code when `SQLSTATES` lists it, its class's
 * `<class>000` when it is of a class taken whole and unlisted, else `code` itself, which `Sqlstate` refuses.
 */
export function sqlstateOf(code: string): string {
  if (LISTED.has(code)) return code;
  return CLASS.test(code) ? `${code.slice(0, 2)}000` : code;
}
