import { type Argument, type Expression, Visitor } from "oxc-parser";
import type { Checked } from "./Checked.ts";
import type { RouteLibrary } from "./RouteLibrary.ts";
import { isTestPath } from "./isTestPath.ts";
import { joinPath } from "./modules/joinPath.ts";

const ROUTER = "@keel/router";
/** The extensions the bundler tries for a specifier, and for a directory's `index`. */
const EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];

/** The file stem of `path` (`src/HealthView.ts` gives `HealthView`). */
const stem = (path: string): string => path.slice(path.lastIndexOf("/") + 1).split(".")[0] ?? "";

/** The text of a string literal or a template with no substitution; undefined for any other expression. */
function literalText(e: Expression | Argument | null | undefined): string | undefined {
  if (e?.type === "Literal" && typeof e.value === "string") return e.value;
  if (e?.type === "TemplateLiteral" && e.expressions.length === 0) return e.quasis[0]?.value.cooked ?? undefined;
  return undefined;
}

/**
 * The files of `paths` the relative specifier `spec` in a file of `dir` names, as the bundler resolves it: its `?query`
 * or `#hash` stripped, the path itself, its stem with each code extension (`./Page.js` names `Page.ts`), and its
 * directory's `index` with each.
 */
function resolve(dir: string, spec: string, paths: ReadonlySet<string>): string[] {
  const at = joinPath(dir, spec.replace(/[?#].*$/s, ""));
  const bare = at.replace(/\.[cm]?[jt]sx?$/, "");
  const tried = new Set([at, ...EXTENSIONS.map((e) => `${bare}${e}`), ...EXTENSIONS.map((e) => `${at}/index${e}`)]);
  return [...tried].filter((p) => paths.has(p));
}

/** The `component` value of a route binding, when the binding is an object literal naming it without a computed key. */
function componentOf(binding: Expression): string | undefined {
  if (binding.type !== "ObjectExpression") return undefined;
  for (const p of binding.properties) {
    if (p.type !== "Property" || p.computed || p.key.type !== "Identifier" || p.key.name !== "component") continue;
    return p.value.type === "Identifier" ? p.value.name : undefined;
  }
  return undefined;
}

/** What one file says of the files it names. */
type Read = {
  /** Each file a relative specifier of it names, with how often. */
  readonly refs: Map<string, number>;
  /** Each file this one binds as a route `component`, by the one default import of it and one route entry. */
  readonly binds: ReadonlySet<string>;
  /** Whether it loads a module by a specifier no literal gives (`import(n)`, `require(n)`, `createRequire`, `import.meta.glob`). */
  readonly wild: boolean;
};

/** The files `c` names among `paths` and the route components its `manifest(` calls bind. */
function readFile(c: Checked, paths: ReadonlySet<string>): Read {
  const { file, parsed } = c;
  const dir = file.path.slice(0, file.path.lastIndexOf("/"));
  const refs = new Map<string, number>();
  let wild = false;
  const ref = (spec: string): void => {
    if (!spec.startsWith(".")) return;
    for (const at of resolve(dir, spec, paths)) refs.set(at, (refs.get(at) ?? 0) + 1);
  };
  /** A specifier argument: a literal is followed, anything else names every file. */
  const load = (arg: Expression | Argument | null | undefined): void => {
    const text = literalText(arg);
    if (text === undefined) wild = true;
    else ref(text);
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
  const uses = new Map<string, number>();
  const named = new Map<string, number>();
  const count = (name: string): void => void named.set(name, (named.get(name) ?? 0) + 1);
  new Visitor({
    ImportExpression: (n) => load(n.source),
    Identifier: (n) => {
      count(n.name);
      if (n.name === "createRequire") wild = true;
    },
    JSXIdentifier: (n) => count(n.name),
    MemberExpression: (n) => {
      const prop = n.computed ? undefined : n.property.type === "Identifier" ? n.property.name : undefined;
      if (n.object.type === "MetaProperty" && (prop === "glob" || prop === "globEager")) wild = true;
    },
    NewExpression: (n) => {
      if (n.callee.type === "Identifier" && n.callee.name === "URL") {
        const text = literalText(n.arguments[0]);
        if (text !== undefined) ref(text);
      }
    },
    CallExpression: (n) => {
      const callee = n.callee;
      const req =
        (callee.type === "Identifier" && callee.name === "require") ||
        (callee.type === "MemberExpression" &&
          ((callee.object.type === "Identifier" && callee.object.name === "require") ||
            (!callee.computed && callee.property.type === "Identifier" && callee.property.name === "require")));
      if (req) load(n.arguments[0]);
      const table = n.arguments[1];
      if (callee.type !== "Identifier" || !manifests.has(callee.name) || table?.type !== "ObjectExpression") return;
      for (const p of table.properties) {
        if (p.type !== "Property") continue;
        const name = componentOf(p.value);
        if (name !== undefined && defaults.has(name)) uses.set(name, (uses.get(name) ?? 0) + 1);
      }
    },
  }).visit(parsed.program);
  // A bound name used anywhere but as one route's `component` (a second route, rendered, exported, passed on) binds no page.
  const binds = new Set<string>();
  for (const [name, n] of uses) {
    const spec = defaults.get(name);
    if (spec === undefined || name === "component" || n !== 1 || (named.get(name) ?? 0) !== 2) continue;
    for (const at of resolve(dir, spec, paths)) binds.add(at);
  }
  return { refs, binds, wild };
}

/**
 * The route component files of the libraries among `checked` (k.library-pages), each to its library's manifest `id`: a
 * file a `manifest(` call of `@keel/router` in a file of the same library binds as one entry's `component`, that
 * component a name the binding file imports by a relative default import and uses nowhere else. A file whose stem the
 * library's `public.exports` lists, that one of `entryFiles` (the files the libraries' `exports` give, patterns
 * included) names, or that any other import, re-export, `import()`, `require` or `new URL` of a file outside test code
 * names, resolved as the bundler resolves it, is none; nor is any file of a library one of whose files loads a module by a
 * specifier no literal gives. So no app or library file renders a page twice.
 */
export function routeComponents(
  checked: readonly Checked[],
  libraryOf: (path: string) => RouteLibrary | undefined,
  entryFiles: ReadonlySet<string>,
): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  const paths = new Set(checked.map((c) => c.file.path));
  const reads = new Map<string, Read>();
  for (const c of checked) if (!isTestPath(c.file.path)) reads.set(c.file.path, readFile(c, paths));
  const wild = new Set<string>();
  for (const [p, r] of reads) {
    const folder = libraryOf(p)?.folder;
    if (r.wild && folder !== undefined) wild.add(folder);
  }
  for (const [p, r] of reads) {
    const lib = libraryOf(p);
    if (lib === undefined || wild.has(lib.folder)) continue;
    for (const at of r.binds) {
      if (out.has(at) || libraryOf(at)?.folder !== lib.folder) continue;
      if (lib.exports.has(stem(at)) || entryFiles.has(at)) continue;
      let all = 0;
      let bound = 0;
      for (const other of reads.values()) {
        all += other.refs.get(at) ?? 0;
        if (other.binds.has(at)) bound++;
      }
      if (all === 1 && bound === 1) out.set(at, lib.id);
    }
  }
  return out;
}
