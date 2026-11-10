import { iso } from "./iso.ts";

/** `YYYY-MM-DDTHH:mm:ss.sssZ` in years 0001 to 9999 that names a real UTC instant (no rollover, no offset). */
export function isInstant(v: string): boolean {
  return /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) && v >= "0001" && iso(Date.parse(v)) === v;
}
