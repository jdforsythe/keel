import type { Diagnostic } from "../../types/Diagnostic.ts";
import type { ModuleInfo } from "./ModuleInfo.ts";
import { moduleDiag } from "./moduleDiag.ts";
import { short } from "./short.ts";

const byName = (a: ModuleInfo, b: ModuleInfo): number => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

/**
 * The app's libraries among `modules` (k.library In an app): each library a non-library manifest names in `deps`, and
 * transitively each one a found library's manifest names; sorted by package name.
 */
function appLibraries(modules: readonly ModuleInfo[], byKey: ReadonlyMap<string, ModuleInfo>): ModuleInfo[] {
  const found = new Set<ModuleInfo>();
  const todo = modules.filter((m) => !m.library);
  for (let m = todo.pop(); m !== undefined; m = todo.pop())
    for (const e of m.manifest?.deps.entries ?? []) {
      const lib = e.value.startsWith("@") ? byKey.get(e.value) : undefined;
      if (lib === undefined || !lib.library || found.has(lib)) continue;
      found.add(lib);
      todo.push(lib);
    }
  return [...found].sort(byName);
}

/**
 * The k.library manifest rules over the discovered modules. E1163: a `deps` entry of one of the app's libraries'
 * manifests that does not begin with `@`, at the entry. E1166: a library whose `id` is a project module's id or another
 * of the app's libraries' ids, at each `deps` entry that names such a library; the message names two of the id's
 * holders, an app module before a library and libraries by package name, the entry's library one of them. No fix.
 */
export function libraryManifests(modules: readonly ModuleInfo[], byKey: ReadonlyMap<string, ModuleInfo>): Diagnostic[] {
  const libraries = appLibraries(modules, byKey);
  const out: Diagnostic[] = [];
  for (const lib of libraries)
    for (const e of lib.manifest?.deps.entries ?? []) {
      if (e.value.startsWith("@")) continue;
      const msg = `library ${short(lib.key)} lists ${short(e.value)} in deps, which names no package`;
      out.push(moduleDiag("E1163", lib.file, e.start, msg, undefined, "k.library"));
    }
  const holders = (id: string): ModuleInfo[] => [
    ...modules.filter((m) => !m.library && m.key === id),
    ...libraries.filter((l) => l.prefix === id),
  ];
  const shared = new Map<string, readonly ModuleInfo[]>();
  for (const lib of libraries) {
    const all = holders(lib.prefix);
    if (all.length > 1) shared.set(lib.key, all);
  }
  for (const m of [...modules.filter((x) => !x.library), ...libraries])
    for (const e of m.manifest?.deps.entries ?? []) {
      const all = shared.get(e.value);
      const lib = byKey.get(e.value);
      if (all === undefined || lib === undefined) continue;
      const pair = all.filter((h) => h === lib || h === all.find((o) => o !== lib)).map((h) => h.key);
      const msg = `module id ${short(lib.prefix)} is held by ${short(pair[0] ?? "")} and ${short(pair[1] ?? "")}`;
      out.push(moduleDiag("E1166", m.file, e.start, msg, undefined, "k.library"));
    }
  return out;
}
