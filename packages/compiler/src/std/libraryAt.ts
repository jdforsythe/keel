import fs from "node:fs";
import path from "node:path";
import { appManifest } from "../internal/appManifest.ts";
import { manifestSource } from "../internal/manifestSource.ts";
import { readJson } from "../internal/readJson.ts";
import type { Library } from "../types/Library.ts";
import { libraryKind } from "./libraryKind.ts";

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
 * The library named `name` whose package folder is `at` (k.library Kind), followed to its real path: its kind
 * (`libraryKind` over its `package.json`), its root manifest's source and literal `id`, and the files under its `src/`
 * and `unsafe/`; undefined when the folder holds no library. An app's libraries (`libraryFiles`) and a library's own
 * folder (k.library-pack Own folder) read a library through it, so both count the same files.
 */
export function libraryAt(at: string, name: string): Library | undefined {
  const kind = libraryKind(readJson(path.join(at, "package.json")), name);
  if (kind === undefined) return undefined;
  const dir = fs.realpathSync(at);
  const manifest = manifestSource(dir);
  const read = manifest === undefined ? null : appManifest(manifest);
  return { name, dir, kind, id: read?.id, manifest, files: CODE.flatMap((d) => walk(path.join(dir, d))) };
}
