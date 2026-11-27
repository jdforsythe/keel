import { posix } from "node:path";

/**
 * A stand-in for the working folder, deep enough that the `..` of any key resolves inside it, so relative paths are
 * compared without reading the process's working folder (`createPlan` is pure).
 */
const BASE = `/${Array.from({ length: 64 }, () => "w").join("/")}`;

/**
 * The folders above `folder` (as typed, relative to the working folder or absolute), nearest first, each as the key
 * prefix its files have in `createPlan`'s `ancestors`: relative to the working folder (`""` for it, `apps`, `..`), or
 * absolute for an absolute `folder`. `depth` bounds how far above the working folder a relative one goes. `rel` gives
 * the path from one of those keys' folders, or the target (`.`), to another.
 */
export function folderAbove(
  folder: string,
  depth = 64,
): { readonly above: readonly string[]; readonly target: string; readonly rel: (from: string, to: string) => string } {
  const absolute = posix.isAbsolute(folder);
  const target = absolute ? posix.normalize(folder) : posix.join(BASE, folder);
  const key = (abs: string): string => (absolute ? abs : posix.relative(BASE, abs));
  const floor = absolute ? "/" : posix.join(BASE, ...Array.from({ length: depth }, () => ".."));
  const above: string[] = [];
  for (let at = posix.dirname(target); ; at = posix.dirname(at)) {
    above.push(key(at));
    if (at === floor || at === "/" || posix.dirname(at) === at) break;
  }
  const abs = (k: string): string => (absolute ? k : posix.join(BASE, k));
  return { above, target: key(target), rel: (from, to) => posix.relative(abs(from), abs(to)) };
}
