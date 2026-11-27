import { existsSync, realpathSync } from "node:fs";
import { dirname, join, relative } from "node:path";

/** `abs` read through the real path of its nearest existing ancestor (the folder need not exist yet); `abs` itself when that cannot be read. */
export function realOf(abs: string): string {
  let at = abs;
  while (!existsSync(at) && dirname(at) !== at) at = dirname(at);
  try {
    return join(realpathSync(at), relative(at, abs));
  } catch {
    return abs;
  }
}
