import fs from "node:fs";
import path from "node:path";
import {
  type Expression,
  type MemberExpression,
  type ObjectExpression,
  type Program,
  Visitor,
  parseSync,
} from "oxc-parser";
import { appManifest } from "./internal/appManifest.ts";
import { entryOf } from "./internal/entryOf.ts";
import { projectManifests } from "./internal/projectManifests.ts";
import { stdRoutes } from "./std/stdRoutes.ts";
import type { RouteLiteral } from "./types/RouteLiteral.ts";
import type { RouteLiterals } from "./types/RouteLiterals.ts";
import type { SourceFile } from "./types/SourceFile.ts";
import type { Topology } from "./types/Topology.ts";

const VERBS: readonly string[] = ["DELETE", "PATCH", "POST", "PUT"];

type Field = { value: string | null } | undefined;

function unwrap(e: Expression): Expression {
  if (e.type === "ParenthesizedExpression") return unwrap(e.expression);
  if (e.type === "TSAsExpression" || e.type === "TSSatisfiesExpression" || e.type === "TSNonNullExpression")
    return unwrap(e.expression);
  return e;
}

/** The name of a non-computed key: an identifier, a string or a number. */
function keyName(k: { type: string }): string | undefined {
  if (k.type === "Identifier" && "name" in k && typeof k.name === "string") return k.name;
  if (k.type === "Literal" && "value" in k && (typeof k.value === "string" || typeof k.value === "number"))
    return String(k.value);
  return undefined;
}

const isUndefined = (e: Expression): boolean => e.type === "Identifier" && e.name === "undefined";

/** A string literal (or a template with no expressions), `null` for `null`/`undefined`; undefined when not literal. */
function text(e: Expression): Field {
  const v = unwrap(e);
  if (v.type === "Literal" && typeof v.value === "string") return { value: v.value };
  if (v.type === "Literal" && v.value === null) return { value: null };
  if (isUndefined(v)) return { value: null };
  if (v.type === "TemplateLiteral" && v.expressions.length === 0) {
    const cooked = v.quasis[0]?.value.cooked;
    if (typeof cooked === "string") return { value: cooked };
  }
  return undefined;
}

/**
 * The initializer of the top-level `const <name> = ...` (exported or not) in `program`. A `let` or `var` may be
 * reassigned, so it has none.
 */
function declared(program: Program, name: string): Expression | undefined {
  for (const s of program.body) {
    const decl = s.type === "ExportNamedDeclaration" ? s.declaration : s;
    if (decl === null || decl.type !== "VariableDeclaration" || decl.kind !== "const") continue;
    for (const d of decl.declarations)
      if (d.id.type === "Identifier" && d.id.name === name && d.init !== null) return unwrap(d.init);
  }
  return undefined;
}

/**
 * The local name `program` exports as `name`: `export const name`, or `export { local as name }` with no `from`.
 * Undefined when no such export is found, or it re-exports from another module.
 */
function exportedLocal(program: Program, name: string): string | undefined {
  for (const s of program.body) {
    if (s.type !== "ExportNamedDeclaration") continue;
    const d = s.declaration;
    if (
      d?.type === "VariableDeclaration" &&
      d.declarations.some((x) => x.id.type === "Identifier" && x.id.name === name)
    )
      return name;
    for (const sp of s.specifiers) {
      const out = sp.exported.type === "Identifier" ? sp.exported.name : sp.exported.value;
      if (out !== name) continue;
      if (s.source !== null || sp.local.type !== "Identifier") return undefined;
      return sp.local.name;
    }
  }
  return undefined;
}

/** `dir/spec` normalized (`/`-separated, `.` and `..` resolved); undefined above the root. */
function join(dir: string, spec: string): string | undefined {
  const out: string[] = dir === "" ? [] : dir.split("/");
  for (const part of spec.split("/")) {
    if (part === "" || part === ".") continue;
    if (part !== "..") out.push(part);
    else if (out.pop() === undefined) return undefined;
  }
  return out.join("/");
}

type Parsed = (path: string) => Program | undefined;

/** The specifier and imported name of the named import bound to `local` in `program`. */
function imported(program: Program, local: string): [string, string] | undefined {
  for (const s of program.body)
    if (s.type === "ImportDeclaration")
      for (const sp of s.specifiers)
        if (sp.type === "ImportSpecifier" && sp.local.name === local)
          return [s.source.value, sp.imported.type === "Identifier" ? sp.imported.name : sp.imported.value];
  return undefined;
}

type At = { file: string; program: Program; parse: Parsed; acts: Map<string, Expression> | null };

/**
 * `e` unwrapped and, while an identifier, followed (8 hops at most) to the initializer that binds it: a top-level
 * `const` of `at.file`, else, for a named import from a relative module, the `const` that module exports under the
 * imported name (`exportedLocal`); with the file that initializer is read in. A name it cannot resolve stays an
 * identifier, which every reader takes as unread.
 */
function follow(e: Expression, from: At): [Expression, At] {
  let v = unwrap(e);
  let at = from;
  let name = v.type === "Identifier" ? v.name : undefined;
  for (let hop = 0; hop < 8 && name !== undefined; hop++) {
    const init = declared(at.program, name);
    if (init !== undefined) {
      v = init;
      name = init.type === "Identifier" ? init.name : undefined;
      continue;
    }
    const imp = imported(at.program, name);
    const file = imp?.[0].startsWith(".") ? join(at.file.split("/").slice(0, -1).join("/"), imp[0]) : undefined;
    const other = file === undefined ? undefined : (at.parse(file) ?? at.parse(`${file}.ts`));
    const local = other && imp && exportedLocal(other, imp[1]);
    if (file === undefined || other === undefined || local === undefined) break;
    at = { ...at, file, program: other };
    name = local;
  }
  return [v, at];
}

/**
 * The `redirect` of the guard `g`, followed to `guard({ redirect: "<literal>" }, fn)`; `null` for `guard({...}, fn)`
 * with no `redirect` and no spread or computed key. Undefined when it does not resolve to either shape.
 */
function guardRedirect(g: Expression, at: At): string | null | undefined {
  const [init] = follow(g, at);
  if (init.type !== "CallExpression" || init.callee.type !== "Identifier" || init.callee.name !== "guard")
    return undefined;
  const decl = init.arguments[0];
  if (decl === undefined || decl.type === "SpreadElement") return undefined;
  const obj = unwrap(decl);
  if (obj.type !== "ObjectExpression") return undefined;
  for (const p of obj.properties) {
    if (p.type !== "Property" || p.computed) return undefined;
    if (keyName(p.key) === "redirect") return text(p.value)?.value ?? undefined;
  }
  return null;
}

/** A key's name: non-computed, or computed from a literal (`['api']`); undefined otherwise. */
const propName = (p: { computed: boolean; key: { type: string } }): string | undefined =>
  !p.computed || p.key.type === "Literal" ? keyName(p.key) : undefined;

/**
 * The fields of entry `e` (followed, `follow`), each with the file it is read in; a spread of an object that follows
 * to a literal is merged in order. Undefined when `e`, a spread or a key is not read statically.
 */
function fields(e: Expression, at: At, depth = 0): Map<string, [Expression, At]> | undefined {
  const [v, here] = follow(e, at);
  if (v.type !== "ObjectExpression" || depth > 8) return undefined;
  const out = new Map<string, [Expression, At]>();
  for (const p of v.properties) {
    const inner = p.type === "SpreadElement" ? fields(p.argument, here, depth + 1) : undefined;
    const k = p.type === "Property" ? propName(p) : undefined;
    if (p.type === "SpreadElement" ? inner === undefined : k === undefined) return undefined;
    for (const [n, x] of inner ?? []) out.set(n, x);
    if (p.type === "Property" && k !== undefined) out.set(k, [p.value, here]);
  }
  return out;
}

/** One route entry's literal fields; `unread` gets the fields that are not literals. */
function readRoute(id: string, value: Expression, at: At, unread: string[]): RouteLiteral {
  const all = fields(value, at);
  if (all === undefined) {
    unread.push(id);
    return {};
  }
  const props = new Map([...all].map(([k, [e]]) => [k, e]));
  const out: { -readonly [K in keyof RouteLiteral]: RouteLiteral[K] } = {};
  for (const field of ["path", "layout"] as const) {
    const e = props.get(field);
    const t = e === undefined ? { value: null } : text(e);
    if (t === undefined) unread.push(`${id} ${field}`);
    else out[field] = t.value;
  }
  const api = all.get("api");
  const ap = api === undefined ? undefined : follow(...api)[0];
  if (ap?.type === "Literal" && typeof ap.value === "boolean") out.api = ap.value;
  else if (ap !== undefined) unread.push(`${id} api`);
  const g = all.get("guard");
  const gv = g === undefined ? undefined : unwrap(g[0]);
  if (gv === undefined || (gv.type === "Literal" && gv.value === null) || isUndefined(gv)) out.guard = null;
  else {
    const redirect = g === undefined ? undefined : guardRedirect(...g);
    if (redirect === undefined) unread.push(`${id} guard`);
    else out.guard = redirect;
  }
  // Actions attach with `routes.actions({...})`; `actions` in an entry is E1505 at evaluation.
  const av = props.has("actions") || at.acts === null ? null : at.acts.get(id);
  const a = av === undefined || av === null ? av : unwrap(av);
  if (a === undefined || (a !== null && isUndefined(a))) out.actions = [];
  else if (a?.type === "ObjectExpression" && a.properties.every((p) => p.type === "Property" && !p.computed)) {
    const verbs = new Set<string>();
    for (const p of a.properties) {
      const k = p.type === "Property" ? keyName(p.key) : undefined;
      if (p.type === "Property" && k !== undefined && VERBS.includes(k) && !isUndefined(unwrap(p.value))) verbs.add(k);
    }
    out.actions = VERBS.filter((x) => verbs.has(x));
  } else unread.push(`${id} actions`);
  for (const field of ["params", "search"] as const) {
    const e = props.get(field);
    const sv = e === undefined ? undefined : unwrap(e);
    if (sv !== undefined && sv.type === "Literal" && sv.value === null) unread.push(`${id} ${field}`);
    else out[field] = sv !== undefined && !isUndefined(sv);
  }
  return out;
}

/** `routes` and every name bound to the same value in `program`: `const a = b` either way, anywhere in the file. */
function manifestNames(program: Program): Set<string> {
  const names = new Set(["routes"]);
  let size = 0;
  while (size !== names.size) {
    size = names.size;
    new Visitor({
      VariableDeclarator: (d) => {
        const init = d.init === null ? undefined : unwrap(d.init);
        if (d.id.type !== "Identifier" || init?.type !== "Identifier") return;
        if (names.has(d.id.name) || names.has(init.name)) names.add(d.id.name).add(init.name);
      },
    }).visit(program);
  }
  return names;
}

/** True when `m` reads `actions` (or any computed key) off one of `names`. */
const readsActions = (m: MemberExpression, names: ReadonlySet<string>): boolean =>
  m.object.type === "Identifier" &&
  names.has(m.object.name) &&
  (m.computed || (m.property.type === "Identifier" && m.property.name === "actions"));

/**
 * The values of the `<manifest>.actions({...})` calls anywhere in `program` (rfc:0063, backlog 0183), by literal route
 * id; the receiver is `routes` or an alias (`manifestNames`). `null` when actions may attach where they cannot be read:
 * an argument that is not a literal object of plain keys, `actions` read without a call or by a computed key.
 */
function attached(program: Program): Map<string, Expression> | null {
  const names = manifestNames(program);
  const out = new Map<string, Expression>();
  const called = new Set<MemberExpression>();
  let unknown = false;
  new Visitor({
    CallExpression: (call) => {
      const c = call.callee;
      if (c.type !== "MemberExpression" || c.computed || !readsActions(c, names)) return;
      called.add(c);
      const arg = call.arguments[0];
      const obj = arg === undefined || arg.type === "SpreadElement" ? undefined : unwrap(arg);
      if (obj?.type !== "ObjectExpression") unknown = true;
      else
        for (const p of obj.properties) {
          const id = p.type === "Property" && !p.computed ? keyName(p.key) : undefined;
          if (p.type !== "Property" || id === undefined) unknown = true;
          else out.set(id, p.value);
        }
    },
    MemberExpression: (m) => {
      if (!called.has(m) && readsActions(m, names)) unknown = true;
    },
  }).visit(program);
  return unknown ? null : out;
}

/**
 * True when a project file other than the manifest `file` reads `actions` (or a computed key) off a binding it imports
 * from `file`, or from the package specifier `spec` that names it (named, or `ns.routes` of a namespace import): those
 * actions are not read statically.
 */
function attachedElsewhere(file: string, sources: ReadonlyMap<string, string>, parse: Parsed, spec?: string): boolean {
  for (const [path, source] of sources) {
    if (path === file || !source.includes("actions")) continue;
    const program = parse(path);
    if (program === undefined) continue;
    const named = new Set<string>();
    const spaces = new Set<string>();
    const dir = path.split("/").slice(0, -1).join("/");
    for (const st of program.body) {
      if (st.type !== "ImportDeclaration") continue;
      const s = st.source.value;
      const at = s.startsWith(".") ? join(dir, s) : undefined;
      if (s !== spec && (at === undefined || (at !== file && `${at}.ts` !== file))) continue;
      for (const sp of st.specifiers)
        if (sp.type === "ImportNamespaceSpecifier") spaces.add(sp.local.name);
        else named.add(sp.local.name);
    }
    if (named.size === 0 && spaces.size === 0) continue;
    let reads = false;
    new Visitor({
      MemberExpression: (m) => {
        const o = m.object;
        const viaSpace = o.type === "MemberExpression" && o.object.type === "Identifier" && spaces.has(o.object.name);
        if (
          readsActions(m, named) ||
          (viaSpace && (m.computed || (m.property.type === "Identifier" && m.property.name === "actions")))
        )
          reads = true;
      },
    }).visit(program);
    if (reads) return true;
  }
  return false;
}

/** The object literal of `routes = manifest({...})` in `program`, or undefined. */
function manifestObject(program: Program | undefined): ObjectExpression | undefined {
  let init = program && declared(program, "routes");
  for (let hop = 0; program && hop < 8 && init?.type === "Identifier"; hop++) init = declared(program, init.name);
  if (init?.type !== "CallExpression" || init.callee.type !== "Identifier" || init.callee.name !== "manifest")
    return undefined;
  const arg = init.arguments[0];
  if (arg === undefined || arg.type === "SpreadElement") return undefined;
  const obj = unwrap(arg);
  return obj.type === "ObjectExpression" ? obj : undefined;
}

/**
 * Read a project's route table from its routes manifests without evaluating them (k.compiler Artifacts): the manifests
 * `vite build` evaluates (`projectManifests`, a placed stdlib module's package `./routes` file read as a package
 * fragment), each `export const routes = manifest({...})` parsed with oxc. Literal
 * route ids, `path`, `layout`, `api`, action verbs (from `routes.actions({...})`), `params`/`search` presence, and a guard's
 * `redirect` (a `guard({ redirect: "..." }, fn)` declared in the manifest or imported from a relative module; `null` for
 * a guard declared without one) are read;
 * anything else is named in `unread`. A spread `...x.routes`, `x` the `routes` export of a package the module's
 * `module.ts` lists in `deps`, reads the manifest of the file that export resolves to (from the module's folder, through the package's `exports`,
 * as the std import step resolves it) by the same rule, without running it.
 * Any other spread (named by its source text), a computed key or an unreadable manifest opens the id set
 * (`closed: false`) and, since it may override them, unreads the routes before it. Undefined when there is no such
 * manifest: `routes.json` is then `{}` and compared by hash. `files` are project files relative to `root` (default
 * `process.cwd()`), the directory packages resolve from.
 */
export function routeLiterals(
  files: readonly SourceFile[],
  options: { readonly topology?: Topology | undefined; readonly root?: string | undefined } = {},
): RouteLiterals | undefined {
  const root = options.root ?? process.cwd();
  const manifests = projectManifests(
    options.topology,
    files.map((f) => f.path),
    root,
  );
  if (manifests.length === 0) return undefined;
  /** A placed stdlib module's routes file: its import specifier and package directory. */
  const std = new Map<string, [spec: string, pkg: string]>();
  for (const d of Object.values(options.topology ?? {}))
    for (const m of d.modules) {
      const at = stdRoutes(root, m);
      if (at !== undefined) std.set(at[0], [at[2], at[1]]);
    }
  const sources = new Map(files.map((f) => [f.path, f.source]));
  /** A project file's text, or an absolute file's a package fragment reads. */
  const textOf = (p: string): string | undefined => {
    if (sources.has(p) || !path.isAbsolute(p)) return sources.get(p);
    try {
      return fs.readFileSync(p, "utf8");
    } catch {
      return undefined;
    }
  };
  const cache = new Map<string, Program | undefined>();
  const parse: Parsed = (p) => {
    if (cache.has(p)) return cache.get(p);
    const source = textOf(p);
    const r = source === undefined ? undefined : parseSync(p, source, { sourceType: "module", lang: "ts" });
    const program = r === undefined || r.errors.length > 0 ? undefined : r.program;
    cache.set(p, program);
    return program;
  };
  const routes = new Map<string, RouteLiteral>();
  const unread: string[] = [];
  let closed = true;
  /** A part whose ids are unknown may override every route read before it. */
  const open = (part: string): void => {
    closed = false;
    for (const id of routes.keys()) routes.set(id, {});
    unread.push(...[...routes.keys()].filter((id) => !unread.includes(id)), part);
  };
  /**
   * The entries of one manifest object in source order. A package fragment has its import specifier `spec`, which
   * names its unread parts, and its package's real directory `pkg`, outside which it reads no file.
   */
  const read = (file: string, program: Program, obj: ObjectExpression, spec?: string, pkg?: string): void => {
    const acts = attachedElsewhere(file, sources, parse, spec) ? null : attached(program);
    const within: Parsed = (p) => {
      try {
        return pkg === undefined || fs.realpathSync(p).startsWith(pkg + path.sep) ? parse(p) : undefined;
      } catch {
        return undefined;
      }
    };
    const mod = spec === undefined ? textOf(file.replace(/routes\.ts$/, "module.ts")) : undefined;
    const deps = (mod === undefined ? null : appManifest(mod))?.deps ?? [];
    for (const p of obj.properties) {
      if (p.type === "SpreadElement") {
        const a = unwrap(p.argument);
        const imp =
          a.type === "MemberExpression" && !a.computed && a.object.type === "Identifier" && a.property.name === "routes"
            ? imported(program, a.object.name)
            : undefined;
        const [, name, sub] = (imp?.[1] === "routes" && /^((?:@[^/]+\/)?[^/]+)(.*)/.exec(imp[0])) || [];
        const at =
          name !== undefined && deps.some((d) => d.value === name)
            ? entryOf(path.join(root, path.dirname(file)), name, `.${sub}`)
            : undefined;
        const other = at === undefined ? undefined : parse(at[0]);
        const o = manifestObject(other);
        if (at && other && o && imp) read(at[0], other, o, imp[0], at[1]);
        else open(`${spec ?? file} ${textOf(file)?.slice(p.start, p.end)}`);
        continue;
      }
      const id = propName(p);
      if (id === undefined) open(`${spec ?? file} ids`);
      else routes.set(id, readRoute(id, p.value, { file, program, parse: within, acts }, unread));
    }
  };
  for (const file of manifests) {
    const program = parse(file);
    const obj = manifestObject(program);
    const [spec, pkg] = std.get(file) ?? [];
    if (program === undefined || obj === undefined) open(spec ?? file);
    else read(file, program, obj, spec, pkg);
  }
  return { routes: Object.fromEntries(routes), closed, unread };
}
