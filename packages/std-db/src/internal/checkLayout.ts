import { defect } from "@keel/schema";
import { LAYOUT } from "./LAYOUT.ts";

/**
 * Whether opening must write the `layout` row (`true` when there is none). A newer layout is E2152; a row that is not
 * a whole number from 1 is E2153 (the database cannot be opened).
 */
export function checkLayout(stored: unknown): boolean {
  if (stored === undefined || stored === null) return true;
  const n = typeof stored === "string" && /^[1-9][0-9]{0,8}$/.test(stored) ? Number(stored) : 0;
  if (n > LAYOUT)
    return defect(`database layout ${n} is newer than this std.db's ${LAYOUT}; upgrade @keel/std-db`, "E2152");
  if (n < 1) return defect("KEEL_DATABASE_URL names a database whose keel_meta layout is not a version", "E2153");
  return false;
}
