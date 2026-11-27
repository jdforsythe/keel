import { existsSync } from "node:fs";
import { join } from "node:path";

/** `name` with each letter's case swapped (`Modules` -> `mODULES`). */
const swapped = (name: string): string =>
  [...name].map((c) => (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase())).join("");

/**
 * Whether the file system at `abs` ignores case (k.create-folder Folder): one of its own entries whose name has a cased
 * letter, stat'd under the other case, exists though no entry is spelled so. A folder with no such entry cannot hold a
 * name that differs from the plan's in case alone, so false.
 */
export function caselessAt(abs: string, names: readonly string[]): boolean {
  const probe = names.find((n) => swapped(n) !== n && !names.includes(swapped(n)));
  return probe !== undefined && existsSync(join(abs, swapped(probe)));
}
