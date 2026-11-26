import { type Dirent, readdirSync } from "node:fs";
import { join } from "node:path";
import { filesSelect } from "./filesSelect.ts";

/** Folders a package manager never packs. */
const NEVER = new Set(["node_modules", ".git"]);
/** Files a package manager packs whatever `files` says (README, LICENSE and the manifest). */
const ALWAYS = /^(?:package\.json|(?:readme|license|licence)(?:\.[^/]*)?)$/i;

/**
 * Binary only: the package-relative paths of the files a tarball of the package at `dir` holds by `files` (k.library-pack
 * Package): those `files` selects, and the manifest, README and LICENSE at the root, never under `node_modules/`,
 * `.git/` or `.keel/e2e-host/`. Sorted.
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
        // The host project `serve({ page })` writes (k.e2e Libraries) is never packed.
        if (!NEVER.has(e.name) && r !== ".keel/e2e-host") walk(join(abs, e.name), r);
      } else if (e.isFile() && ((rel === "" && ALWAYS.test(e.name)) || filesSelect(files, r))) out.push(r);
    }
  };
  walk(dir, "");
  return out.sort();
}
