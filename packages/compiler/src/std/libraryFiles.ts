import fs from "node:fs";
import path from "node:path";
import { appManifest } from "../internal/appManifest.ts";
import { libraryDir } from "../internal/libraryDir.ts";
import { manifestSource } from "../internal/manifestSource.ts";
import { readJson } from "../internal/readJson.ts";
import type { Library } from "../types/Library.ts";
import { libraryKind } from "./libraryKind.ts";

const MANIFEST = /(?:^|\/)modules\/[^/]+\/module\.[cm]?[jt]s$/;
const CODE = ["src", "unsafe"];

/** The real paths of the files under `dir`, recursively, sorted; none when it is not a folder. */
function walk(dir: string): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .flatMap((e) => {
      const at = path.join(dir, e.name);
      return e.isDirectory() ? walk(at) : e.isFile() ? [fs.realpathSync(at)] : [];
    })
    .sort();
}

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
    const kind = at === undefined ? undefined : libraryKind(readJson(path.join(at, "package.json")), name);
    if (at === undefined || kind === undefined) return;
    const dir = fs.realpathSync(at);
    const manifest = manifestSource(dir);
    const read = manifest === undefined ? null : appManifest(manifest);
    const files = CODE.flatMap((d) => walk(path.join(dir, d)));
    out.set(name, { name, dir, kind, id: read?.id, manifest, files });
    for (const d of read?.deps ?? []) visit(dir, d.value);
  };
  for (const f of files) {
    if (!MANIFEST.test(f.path)) continue;
    const from = path.dirname(path.resolve(root, f.path));
    for (const d of appManifest(f.source)?.deps ?? []) visit(from, d.value);
  }
  return [...out.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}
