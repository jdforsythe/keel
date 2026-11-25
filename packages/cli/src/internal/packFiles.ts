import { type Dirent, readdirSync } from "node:fs";
import { join } from "node:path";

/** Folders a package manager never packs. */
const NEVER = new Set(["node_modules", ".git"]);
/** Files a package manager packs whatever `files` says (README, LICENSE and the manifest). */
const ALWAYS = /^(?:package\.json|(?:readme|license|licence)(?:\.[^/]*)?)$/i;

/** A `files` entry as a test of a package-relative path: the entry itself, anything under it, or its glob. */
const matcher = (entry: string): ((p: string) => boolean) => {
  const e = entry.replace(/^\.\//, "").replace(/\/+$/, "");
  if (!/[*?]/.test(e)) return (p) => p === e || p.startsWith(`${e}/`);
  const glob = e
    .split(/(\*\*\/?|\*|\?)/)
    .map((t) =>
      t === "**" || t === "**/"
        ? ".*"
        : t === "*"
          ? "[^/]*"
          : t === "?"
            ? "[^/]"
            : t.replace(/[.+^${}()|[\]\\]/g, "\\$&"),
    )
    .join("");
  const re = new RegExp(`^${glob}(?:/.*)?$`);
  return (p) => re.test(p);
};

/** Whether `files` (a `package.json` `files` list) selects the package-relative path `p`, `!` entries excluding. */
export function filesSelect(files: readonly string[], p: string): boolean {
  let hit = false;
  for (const f of files) {
    if (f.startsWith("!")) {
      if (hit && matcher(f.slice(1))(p)) hit = false;
    } else if (!hit && matcher(f)(p)) hit = true;
  }
  return hit;
}

/**
 * Binary only: the package-relative paths of the files a tarball of the package at `dir` holds by `files` (k.library-pack
 * Package): those `files` selects, and the manifest, README and LICENSE at the root, never under `node_modules/` or
 * `.git/`. Sorted.
 */
export function packFiles(dir: string, files: readonly string[]): string[] {
  const out: string[] = [];
  const walk = (abs: string, rel: string): void => {
    let entries: Dirent[];
    try {
      entries = readdirSync(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const r = rel === "" ? e.name : `${rel}/${e.name}`;
      if (e.isDirectory()) {
        if (!NEVER.has(e.name)) walk(join(abs, e.name), r);
      } else if (e.isFile() && ((rel === "" && ALWAYS.test(e.name)) || filesSelect(files, r))) out.push(r);
    }
  };
  walk(dir, "");
  return out.sort();
}
