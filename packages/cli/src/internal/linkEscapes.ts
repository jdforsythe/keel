import { lstatSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative } from "node:path";

/** Whether `abs` is outside folder `real`, `real` itself excluded. */
const outside = (real: string, abs: string): boolean => {
  const rel = relative(real, abs);
  return rel.split(/[\\/]/)[0] === ".." || isAbsolute(rel);
};
const link = (abs: string): boolean | undefined => {
  try {
    return lstatSync(abs).isSymbolicLink();
  } catch {
    return undefined;
  }
};

/**
 * Whether a write to `abs` would follow a symlink out of `real`, a folder's real path (which need not exist yet):
 * `abs` is itself a symlink, or `abs` read through the real path of its nearest existing ancestor is outside `real`.
 * An unreadable ancestor counts as escaping. `applyWrites` (k.scaffold E1357) and the shell files (k.shell E1585) read it.
 */
export function linkEscapes(real: string, abs: string): boolean {
  if (link(abs) === true) return true;
  let dir = abs;
  while (dir !== dirname(dir) && link(dir) === undefined) dir = dirname(dir);
  try {
    return outside(real, join(realpathSync(dir), relative(dir, abs)));
  } catch {
    return true;
  }
}
