import path from "node:path";
import { appManifest } from "../internal/appManifest.ts";
import { libraryDir } from "../internal/libraryDir.ts";
import type { Library } from "../types/Library.ts";
import { libraryAt } from "./libraryAt.ts";

const MANIFEST = /(?:^|\/)modules\/[^/]+\/module\.[cm]?[jt]s$/;

/**
 * The libraries of the app whose files are `files` (paths relative to `root`, or absolute), sorted by name (k.library In
 * an app): each `@` entry in the `deps` of an app manifest (`modules/<id>/module.ts` at any depth) that resolves, from
 * the manifest's folder as Node resolves it, to a library (`libraryKind`), and transitively each `@` entry of a found
 * library's root manifest, resolved from the library's real folder. A linked package is followed to its real path; a
 * name is found once. An entry that resolves to no library is left out (E1159 reports it).
 */
export function libraryFiles(
  root: string,
  files: readonly { readonly path: string; readonly source: string }[],
): Library[] {
  const out = new Map<string, Library>();
  const visit = (from: string, name: string): void => {
    if (out.has(name)) return;
    const at = libraryDir(from, name);
    const lib = at === undefined ? undefined : libraryAt(at, name);
    if (lib === undefined) return;
    out.set(name, lib);
    const read = lib.manifest === undefined ? null : appManifest(lib.manifest);
    for (const d of read?.deps ?? []) visit(lib.dir, d.value);
  };
  for (const f of files) {
    if (!MANIFEST.test(f.path)) continue;
    const from = path.dirname(path.resolve(root, f.path));
    for (const d of appManifest(f.source)?.deps ?? []) visit(from, d.value);
  }
  return [...out.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}
