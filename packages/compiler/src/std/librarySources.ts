import fs from "node:fs";
import type { SourceFile } from "../types/SourceFile.ts";
import { appLibraries } from "./appLibraries.ts";
import { libraryRel } from "./libraryRel.ts";

const CODE = /\.[cm]?[jt]sx?$/;

/**
 * The code files of the libraries the project at `root` compiles (`appLibraries`), each at the path it compiles at
 * (`libraryRel`: `modules/<id>/<f>`), sorted by it. The `.keel/` artifacts derive from these with the app's own sources,
 * in the Vite plugin, `keel build` and `keel check`'s E1005 alike (k.library In an app).
 */
export function librarySources(root: string): SourceFile[] {
  const libraries = appLibraries(root);
  const out: SourceFile[] = [];
  for (const lib of libraries)
    for (const f of lib.files) {
      const rel = CODE.test(f) && !/\.d\.[cm]?ts$/.test(f) ? libraryRel(libraries, f) : undefined;
      if (rel !== undefined) out.push({ path: rel, source: fs.readFileSync(f, "utf8") });
    }
  return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
