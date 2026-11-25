import { type Expression, Visitor } from "oxc-parser";
import type { Checked } from "./Checked.ts";
import type { RouteLibrary } from "./RouteLibrary.ts";
import { joinPath } from "./modules/joinPath.ts";

const ROUTER = "@keel/router";

/** The file stem of `path` (`src/HealthView.ts` gives `HealthView`). */
const stem = (path: string): string => path.slice(path.lastIndexOf("/") + 1).split(".")[0] ?? "";

/** The `component` value of a route binding, when the binding is an object literal naming it without a computed key. */
function componentOf(binding: Expression): string | undefined {
  if (binding.type !== "ObjectExpression") return undefined;
  for (const p of binding.properties) {
    if (p.type !== "Property" || p.computed || p.key.type !== "Identifier" || p.key.name !== "component") continue;
    return p.value.type === "Identifier" ? p.value.name : undefined;
  }
  return undefined;
}

/**
 * The route component files of the libraries among `checked` (k.library Ids), each to its library's manifest `id`: a
 * file a `manifest(` call of `@keel/router` in a file of the same library binds as an entry's `component`, that
 * component a name the binding file imports by a relative default import. A file whose stem the library's
 * `public.exports` lists, or that one of `entryFiles` (the files the libraries' `exports` give) names, is none, so no
 * app imports a page and renders it twice.
 */
export function routeComponents(
  checked: readonly Checked[],
  libraryOf: (path: string) => RouteLibrary | undefined,
  entryFiles: ReadonlySet<string>,
): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  const paths = new Set(checked.map((c) => c.file.path));
  for (const { file, parsed } of checked) {
    const lib = libraryOf(file.path);
    if (lib === undefined) continue;
    const defaults = new Map<string, string>();
    const manifests = new Set<string>();
    for (const st of parsed.program.body) {
      if (st.type !== "ImportDeclaration" || st.importKind === "type") continue;
      for (const sp of st.specifiers) {
        if (sp.type === "ImportDefaultSpecifier" && st.source.value.startsWith("."))
          defaults.set(sp.local.name, st.source.value);
        if (st.source.value !== ROUTER || sp.type !== "ImportSpecifier" || sp.importKind === "type") continue;
        const imported = sp.imported.type === "Identifier" ? sp.imported.name : String(sp.imported.value);
        if (imported === "manifest") manifests.add(sp.local.name);
      }
    }
    if (manifests.size === 0 || defaults.size === 0) continue;
    const dir = file.path.slice(0, file.path.lastIndexOf("/"));
    new Visitor({
      CallExpression: (n) => {
        const table = n.arguments[1];
        if (n.callee.type !== "Identifier" || !manifests.has(n.callee.name) || table?.type !== "ObjectExpression")
          return;
        for (const p of table.properties) {
          if (p.type !== "Property") continue;
          const name = componentOf(p.value);
          const spec = name === undefined ? undefined : defaults.get(name);
          if (spec === undefined) continue;
          const at = joinPath(dir, spec);
          const other = libraryOf(at);
          if (!paths.has(at) || other?.folder !== lib.folder || lib.exports.has(stem(at)) || entryFiles.has(at))
            continue;
          out.set(at, lib.id);
        }
      },
    }).visit(parsed.program);
  }
  return out;
}
