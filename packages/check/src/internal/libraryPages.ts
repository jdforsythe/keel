import type { SourceFile } from "../types/SourceFile.ts";
import type { Checked } from "./Checked.ts";
import type { LibraryView } from "./LibraryView.ts";
import type { RouteLibrary } from "./RouteLibrary.ts";
import { readManifest } from "./modules/readManifest.ts";
import { parseFile } from "./parseFile.ts";
import { routeComponents } from "./routeComponents.ts";

/**
 * The route component files of the libraries among `checked` (real paths), each to its library's manifest `id`
 * (`routeComponents`, k.library Ids), read with `libs` over `all`: a library's manifest is the `module.ts` of its
 * package folder, and its entries' files are the ones `libs.entries` gives.
 */
export function libraryPages(
  checked: readonly Checked[],
  all: readonly SourceFile[],
  libs: LibraryView,
): ReadonlyMap<string, string> {
  const byPath = new Map(all.map((f) => [f.path, f]));
  const known = new Map<string, RouteLibrary | undefined>();
  const libraryOf = (p: string): RouteLibrary | undefined => {
    const folder = libs.folder(p);
    if (folder === undefined) return undefined;
    if (known.has(folder)) return known.get(folder);
    const file = byPath.get(`${folder}module.ts`);
    const parsed = file === undefined ? undefined : parseFile(file);
    const m = parsed?.ok === true ? readManifest(parsed.program) : null;
    const lib =
      m === null || m.id === null
        ? undefined
        : { folder, id: m.id, exports: new Set(m.exports.entries.map((e) => e.value)) };
    known.set(folder, lib);
    return lib;
  };
  return routeComponents(checked, libraryOf, new Set([...libs.entries.values()].map((p) => libs.real(p))));
}
