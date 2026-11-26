import { type Expression, Visitor } from "oxc-parser";
import type { Checked } from "./Checked.ts";
import type { RouteLibrary } from "./RouteLibrary.ts";
import { joinPath } from "./modules/joinPath.ts";

const ROUTER = "@keel/router";

/** The file stem of `path` (`src/HealthView.ts` gives `HealthView`). */
const stem = (path: string): string => path.slice(path.lastIndexOf("/") + 1).split(".")[0] ?? "";
/** `path` without its code extension, so `./Page` and `./Page.ts` name one file. */
const bare = (path: string): string => path.replace(/\.[cm]?[jt]sx?$/, "");

/** The `component` value of a route binding, when the binding is an object literal naming it without a computed key. */
function componentOf(binding: Expression): string | undefined {
  if (binding.type !== "ObjectExpression") return undefined;
  for (const p of binding.properties) {
    if (p.type !== "Property" || p.computed || p.key.type !== "Identifier" || p.key.name !== "component") continue;
    return p.value.type === "Identifier" ? p.value.name : undefined;
  }
  return undefined;
}

/** What one library file says of the files it names: each relative specifier it imports, re-exports or `import()`s. */
type Read = {
  /** Each file a relative specifier names (extension dropped), with how often. */
  readonly refs: Map<string, number>;
  /** Each file this one binds as a route `component` (its path as written), with the local name it binds. */
  readonly binds: Map<string, string>;
};

/** The relative module references of `c` and the route components its `manifest(` calls bind. */
function readFile(c: Checked): Read {
  const { file, parsed } = c;
  const dir = file.path.slice(0, file.path.lastIndexOf("/"));
  const refs = new Map<string, number>();
  const ref = (spec: string): void => {
    if (!spec.startsWith(".")) return;
    const at = bare(joinPath(dir, spec));
    refs.set(at, (refs.get(at) ?? 0) + 1);
  };
  const defaults = new Map<string, string>();
  const manifests = new Set<string>();
  for (const st of parsed.program.body) {
    if (st.type === "ExportAllDeclaration") ref(st.source.value);
    if (st.type === "ExportNamedDeclaration" && st.source !== null) ref(st.source.value);
    if (st.type !== "ImportDeclaration") continue;
    ref(st.source.value);
    for (const sp of st.specifiers) {
      if (sp.type === "ImportDefaultSpecifier" && st.source.value.startsWith(".") && st.importKind !== "type")
        defaults.set(sp.local.name, st.source.value);
      if (st.source.value !== ROUTER || sp.type !== "ImportSpecifier" || sp.importKind === "type") continue;
      const imported = sp.imported.type === "Identifier" ? sp.imported.name : String(sp.imported.value);
      if (imported === "manifest") manifests.add(sp.local.name);
    }
  }
  const binds = new Map<string, string>();
  const uses = new Map<string, number>();
  const named = new Map<string, number>();
  const count = (name: string): void => void named.set(name, (named.get(name) ?? 0) + 1);
  new Visitor({
    ImportExpression: (n) => {
      if (n.source.type === "Literal" && typeof n.source.value === "string") ref(n.source.value);
    },
    Identifier: (n) => count(n.name),
    JSXIdentifier: (n) => count(n.name),
    CallExpression: (n) => {
      const table = n.arguments[1];
      if (n.callee.type !== "Identifier" || !manifests.has(n.callee.name) || table?.type !== "ObjectExpression") return;
      for (const p of table.properties) {
        if (p.type !== "Property") continue;
        const name = componentOf(p.value);
        const spec = name === undefined ? undefined : defaults.get(name);
        if (name === undefined || spec === undefined) continue;
        binds.set(spec, name);
        uses.set(name, (uses.get(name) ?? 0) + 1);
      }
    },
  }).visit(parsed.program);
  // A bound name used anywhere but as a route's `component` (rendered, exported, passed on) binds no page.
  for (const [spec, name] of binds)
    if (name === "component" || (named.get(name) ?? 0) !== 1 + (uses.get(name) ?? 0)) binds.delete(spec);
  return { refs, binds };
}

/**
 * The route component files of the libraries among `checked` (k.library Ids), each to its library's manifest `id`: a
 * file a `manifest(` call of `@keel/router` in a file of the same library binds as an entry's `component`, that
 * component a name the binding file imports by a relative default import and uses nowhere else. A file whose stem the
 * library's `public.exports` lists, that one of `entryFiles` (the files the libraries' `exports` give) names, or that
 * a file of the library imports, re-exports or `import()`s other than by that default import in a file binding it, is
 * none, so no app or library file renders a page twice.
 */
export function routeComponents(
  checked: readonly Checked[],
  libraryOf: (path: string) => RouteLibrary | undefined,
  entryFiles: ReadonlySet<string>,
): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  const paths = new Set(checked.map((c) => c.file.path));
  const reads = new Map<string, Read>();
  for (const c of checked) if (libraryOf(c.file.path) !== undefined) reads.set(c.file.path, readFile(c));
  /** How often the files of `folder` name `at`, and how often by a binding's default import. */
  const named = (folder: string, at: string): { all: number; bound: number } => {
    let all = 0;
    let bound = 0;
    for (const [p, r] of reads) {
      if (libraryOf(p)?.folder !== folder) continue;
      all += r.refs.get(bare(at)) ?? 0;
      const dir = p.slice(0, p.lastIndexOf("/"));
      for (const spec of r.binds.keys()) if (bare(joinPath(dir, spec)) === bare(at)) bound++;
    }
    return { all, bound };
  };
  for (const [p, r] of reads) {
    const lib = libraryOf(p);
    if (lib === undefined) continue;
    const dir = p.slice(0, p.lastIndexOf("/"));
    for (const spec of r.binds.keys()) {
      const at = joinPath(dir, spec);
      if (out.has(at) || !paths.has(at) || libraryOf(at)?.folder !== lib.folder) continue;
      if (lib.exports.has(stem(at)) || entryFiles.has(at)) continue;
      const { all, bound } = named(lib.folder, at);
      if (all === bound) out.set(at, lib.id);
    }
  }
  return out;
}
