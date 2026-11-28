import fs from "node:fs";
import path from "node:path";

/**
 * A real-path lookup for one pass over many files: each path's answer is `fs.realpathSync`'s (undefined where that
 * throws), and each folder on the way is resolved once for the pass. A path that is no symbolic link is its folder's
 * real path joined with its name; a link is resolved by `fs.realpathSync`. Answers are kept for the lookup's life, so
 * a pass that must see a change during it asks a new lookup.
 */
export function realPaths(): (file: string) => string | undefined {
  const memo = new Map<string, string | undefined>();
  const of = (p: string): string | undefined => {
    if (memo.has(p)) return memo.get(p);
    const parent = path.dirname(p);
    let v: string | undefined;
    if (parent === p) v = p;
    else {
      let link: boolean | undefined;
      try {
        link = fs.lstatSync(p, { throwIfNoEntry: false })?.isSymbolicLink();
      } catch {
        link = undefined;
      }
      if (link === true) {
        try {
          v = fs.realpathSync(p);
        } catch {
          v = undefined;
        }
      } else if (link === false) {
        const dir = of(parent);
        v = dir === undefined ? undefined : path.join(dir, path.basename(p));
      }
    }
    memo.set(p, v);
    return v;
  };
  return (file) => of(path.resolve(file));
}
