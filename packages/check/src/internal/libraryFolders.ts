import { libraryKind } from "@keel/compiler/std/libraryKind";
import type { SourceFile } from "../types/SourceFile.ts";
import type { LibraryView } from "./LibraryView.ts";
import { readManifest } from "./modules/readManifest.ts";
import { parseFile } from "./parseFile.ts";

const PACKAGE = /^((?:(?!node_modules\/).)*?)node_modules\/(@[^/]+\/[^/]+)\/package\.json$/;
const FILE = /^((?:(?!node_modules\/).)*?)node_modules\/(@[^/]+\/[^/]+)\/((?:src|unsafe)\/.+)$/;

/** The parsed JSON of `source`; undefined when it does not parse. */
function parse(source: string): unknown {
  try {
    const v: unknown = JSON.parse(source);
    return v;
  } catch {
    return undefined;
  }
}

/**
 * The library files among `files` and the paths rules read them at (`LibraryView`). A library is a
 * `<p>node_modules/<name>/package.json` that `libraryKind` reads as `library`, `<p>` holding no `node_modules/`, beside a
 * `module.ts` whose literal `id` names the folder its files read under (the package name without one). A library file
 * whose view is the path of a file of `files` keeps its own path.
 */
export function libraryFolders(files: readonly SourceFile[]): LibraryView {
  const ids = new Map<string, string>();
  const packages: SourceFile[] = [];
  const byPath = new Map(files.map((f) => [f.path, f]));
  for (const f of files) {
    const m = PACKAGE.exec(f.path);
    if (m === null) continue;
    const [, prefix = "", name = ""] = m;
    if (libraryKind(parse(f.source), name) !== "library") continue;
    const manifest = byPath.get(`${prefix}node_modules/${name}/module.ts`);
    if (manifest === undefined) continue;
    const parsed = parseFile(manifest);
    const id = parsed.ok ? readManifest(parsed.program)?.id : undefined;
    ids.set(`${prefix}node_modules/${name}/`, `${prefix}modules/${id ?? name}/`);
    packages.push(f);
  }
  const toView = new Map<string, string>();
  const toReal = new Map<string, string>();
  const folders = new Map<string, string>();
  if (ids.size > 0)
    for (const f of files) {
      const m = FILE.exec(f.path);
      if (m === null) continue;
      const [, prefix = "", name = "", rest = ""] = m;
      const folder = `${prefix}node_modules/${name}/`;
      const under = ids.get(folder);
      if (under === undefined || byPath.has(`${under}${rest}`)) continue;
      toView.set(f.path, `${under}${rest}`);
      toReal.set(`${under}${rest}`, f.path);
      folders.set(f.path, folder);
    }
  return {
    view: (p) => toView.get(p) ?? p,
    real: (p) => toReal.get(p) ?? p,
    folder: (p) => folders.get(p),
    packages,
  };
}
