import type { SourceFile } from "../types/SourceFile.ts";
import type { Checked } from "./Checked.ts";
import type { LibraryView } from "./LibraryView.ts";
import type { RouteLibrary } from "./RouteLibrary.ts";
import { entryTarget } from "./entryTarget.ts";
import { readManifest } from "./modules/readManifest.ts";
import { parseFile } from "./parseFile.ts";
import { routeComponents } from "./routeComponents.ts";

/**
 * The route component files of the libraries among `checked` (real paths), each to its library's manifest `id`
 * (`routeComponents`, k.library-pages), read with `libs` over `all`: a library's manifest is the `module.ts` of its
 * package folder, and its entries' files are the ones `libs.entries` gives and the ones an `exports` pattern's target
 * (`./src/*`, at `keel`, else the target Node imports) matches.
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
  const entries = new Set([...libs.entries.values()].map((p) => libs.real(p)));
  for (const pkg of libs.packages) {
    const folder = pkg.path.slice(0, pkg.path.length - "package.json".length);
    for (const target of patternTargets(pkg.source)) {
      const [head = "", tail = ""] = target.replace(/^\.\//, "").split("*");
      for (const f of all) {
        const rel = f.path.startsWith(folder) ? f.path.slice(folder.length) : undefined;
        if (rel !== undefined && rel.length >= head.length + tail.length && rel.startsWith(head) && rel.endsWith(tail))
          entries.add(f.path);
      }
    }
  }
  return routeComponents(checked, libraryOf, entries);
}

/** The targets of the `*` pattern entries of a `package.json`'s `exports`, as `entryTarget` reads each. */
function patternTargets(source: string): string[] {
  let pkg: unknown;
  try {
    pkg = JSON.parse(source);
  } catch {
    return [];
  }
  const exports: unknown = typeof pkg === "object" && pkg !== null ? Reflect.get(pkg, "exports") : undefined;
  if (typeof exports !== "object" || exports === null) return [];
  const out: string[] = [];
  for (const [key, target] of Object.entries(exports)) {
    const at = entryTarget(target);
    if (key.includes("*") && at?.includes("*") === true) out.push(at);
  }
  return out;
}
