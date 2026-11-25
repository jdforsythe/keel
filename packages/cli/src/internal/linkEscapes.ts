import { lstatSync, realpathSync } from "node:fs";
import type { Stats } from "node:fs";
import { dirname, isAbsolute, join, relative } from "node:path";

/** Whether `abs` is outside folder `real`, `real` itself excluded, comparing by segment. */
const outside = (real: string, abs: string): boolean => {
  const rel = relative(real, abs);
  return rel.split(/[\\/]/)[0] === ".." || isAbsolute(rel);
};
/** The `lstat` of `abs`; "none" when nothing is there, "unread" when it cannot be read. */
const entry = (abs: string): Stats | "none" | "unread" => {
  try {
    return lstatSync(abs);
  } catch (e) {
    return e instanceof Error && "code" in e && (e.code === "ENOENT" || e.code === "ENOTDIR") ? "none" : "unread";
  }
};
/**
 * `abs` read through the real path of its nearest existing ancestor, joined with the rest of the path; undefined when
 * that ancestor cannot be read (no permission, or a dangling link among the ancestors).
 */
const resolved = (abs: string): string | undefined => {
  let dir = abs;
  let at = entry(dir);
  while (at === "none" && dir !== dirname(dir)) {
    dir = dirname(dir);
    at = entry(dir);
  }
  if (at === "unread") return undefined;
  try {
    return join(realpathSync(dir), relative(dir, abs));
  } catch {
    return undefined;
  }
};

/**
 * Whether a write to `abs` is carried out of `real` by a link (k.scaffold Links), `real` being a folder's real path
 * (which need not exist yet): `abs` is a symbolic link, an existing file with more than one hard link, or a path whose
 * nearest existing ancestor's real path, joined with the rest of the path, is outside `real`. An ancestor that cannot
 * be read counts as outside, and a `real` that is not a real path makes every target escape. `applyWrites` (E1357)
 * and the shell files (k.shell E1585) read it.
 */
export function linkEscapes(real: string, abs: string): boolean {
  if (resolved(real) !== real) return true;
  const st = entry(abs);
  if (st === "unread") return true;
  if (st !== "none" && (st.isSymbolicLink() || (st.isFile() && st.nlink > 1))) return true;
  const at = resolved(abs);
  return at === undefined || outside(real, at);
}
