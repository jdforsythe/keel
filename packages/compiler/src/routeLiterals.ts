import {
  type Expression,
  type MemberExpression,
  type ObjectExpression,
  type Program,
  Visitor,
  parseSync,
} from "oxc-parser";
import { projectManifests } from "./internal/projectManifests.ts";
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

/** The initializer of the top-level `const <name> = ...` (exported or not) in `program`. */
function declared(program: Program, name: string): Expression | undefined {
  for (const s of program.body) {
    const decl = s.type === "ExportNamedDeclaration" ? s.declaration : s;
    if (decl === null || decl.type !== "VariableDeclaration") continue;
    for (const d of decl.declarations)
      if (d.id.type === "Identifier" && d.id.name === name && d.init !== null) return unwrap(d.init);
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

/**
 * The `redirect` of the guard bound to `name` in the manifest `file`: a `const` there, or one imported from a relative
 * module, initialized as `guard({ redirect: "<literal>" }, fn)`. Undefined when it does not resolve to that shape.
 */
function guardRedirect(file: string, program: Program, name: string, parse: Parsed): string | undefined {
  let target: { program: Program; name: string } | undefined;
  const local = declared(program, name);
  if (local !== undefined) target = { program, name };
  for (const s of program.body) {
    if (target !== undefined || s.type !== "ImportDeclaration" || !s.source.value.startsWith(".")) continue;
    for (const sp of s.specifiers) {
      if (sp.type !== "ImportSpecifier" || sp.local.name !== name) continue;
      const dir = file.split("/").slice(0, -1).join("/");
      const at = join(dir, s.source.value);
      const other = at === undefined ? undefined : (parse(at) ?? parse(`${at}.ts`));
      const imported = sp.imported.type === "Identifier" ? sp.imported.name : sp.imported.value;
      if (other !== undefined) target = { program: other, name: imported };
    }
  }
  const init = target === undefined ? undefined : declared(target.program, target.name);
  if (init?.type !== "CallExpression" || init.callee.type !== "Identifier" || init.callee.name !== "guard")
    return undefined;
  const decl = init.arguments[0];
  if (decl === undefined || decl.type === "SpreadElement") return undefined;
  const obj = unwrap(decl);
  if (obj.type !== "ObjectExpression") return undefined;
  for (const p of obj.properties)
    if (p.type === "Property" && !p.computed && keyName(p.key) === "redirect") {
      const v = text(p.value);
      return v?.value ?? undefined;
    }
  return undefined;
}

/** One route entry's literal fields; `unread` gets the fields that are not literals. */
function readRoute(
  id: string,
  value: Expression,
  at: { file: string; program: Program; parse: Parsed; acts: Map<string, Expression> | null },
  unread: string[],
): RouteLiteral {
  const v = unwrap(value);
  if (
    v.type !== "ObjectExpression" ||
    v.properties.some((p) => p.type === "SpreadElement" || (p.type === "Property" && p.computed))
  ) {
    unread.push(id);
    return {};
  }
  const props = new Map<string, Expression>();
  for (const p of v.properties) {
    const k = p.type === "Property" ? keyName(p.key) : undefined;
    if (p.type === "Property" && k !== undefined) props.set(k, p.value);
  }
  const out: { -readonly [K in keyof RouteLiteral]: RouteLiteral[K] } = {};
  for (const field of ["path", "layout"] as const) {
    const e = props.get(field);
    const t = e === undefined ? { value: null } : text(e);
    if (t === undefined) unread.push(`${id} ${field}`);
    else out[field] = t.value;
  }
  const g = props.get("guard");
  const gv = g === undefined ? undefined : unwrap(g);
  if (gv === undefined || (gv.type === "Literal" && gv.value === null) || isUndefined(gv)) out.guard = null;
  else {
    const redirect = gv.type === "Identifier" ? guardRedirect(at.file, at.program, gv.name, at.parse) : undefined;
    if (redirect === undefined) unread.push(`${id} guard`);
    else out.guard = redirect;
  }
  // Actions attach with `routes.actions({...})` (rfc:0063); `actions` in an entry is E1505 at evaluation.
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
 * from `file` (named, or `ns.routes` of a namespace import): those actions are not read statically (backlog 0183).
 */
function attachedElsewhere(file: string, sources: ReadonlyMap<string, string>, parse: Parsed): boolean {
  for (const [path, source] of sources) {
    if (path === file || !source.includes("actions")) continue;
    const program = parse(path);
    if (program === undefined) continue;
    const named = new Set<string>();
    const spaces = new Set<string>();
    const dir = path.split("/").slice(0, -1).join("/");
    for (const st of program.body) {
      if (st.type !== "ImportDeclaration" || !st.source.value.startsWith(".")) continue;
      const at = join(dir, st.source.value);
      if (at !== file && `${at}.ts` !== file) continue;
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
function manifestObject(program: Program): ObjectExpression | undefined {
  let init = declared(program, "routes");
  for (let hop = 0; hop < 8 && init?.type === "Identifier"; hop++) init = declared(program, init.name);
  if (init?.type !== "CallExpression" || init.callee.type !== "Identifier" || init.callee.name !== "manifest")
    return undefined;
  const arg = init.arguments[0];
  if (arg === undefined || arg.type === "SpreadElement") return undefined;
  const obj = unwrap(arg);
  return obj.type === "ObjectExpression" ? obj : undefined;
}

/**
 * Read a project's route table from its routes manifests without evaluating them (k.compiler Artifacts, rfc:0059):
 * the manifests `vite build` evaluates (`projectManifests`), each `export const routes = manifest({...})` parsed with
 * oxc. Literal route ids, `path`, `layout`, action verbs (from `routes.actions({...})`, rfc:0063), `params`/`search`
 * presence, and a guard's `redirect` (a `guard({ redirect: "..." }, fn)` declared in the manifest or imported from a
 * relative module) are read; anything else is named in `unread`. A spread, computed key or unreadable manifest opens
 * the id set (`closed: false`) and, since it may override them, unreads the routes before it. Undefined when there is no such manifest: `routes.json` is then
 * `{}` and compared by hash. `files` are root-relative project files.
 */
export function routeLiterals(
  files: readonly SourceFile[],
  options: { readonly topology?: Topology | undefined } = {},
): RouteLiterals | undefined {
  const manifests = projectManifests(
    options.topology,
    files.map((f) => f.path),
  );
  if (manifests.length === 0) return undefined;
  const sources = new Map(files.map((f) => [f.path, f.source]));
  const cache = new Map<string, Program | undefined>();
  const parse: Parsed = (path) => {
    if (cache.has(path)) return cache.get(path);
    const source = sources.get(path);
    const r = source === undefined ? undefined : parseSync(path, source, { sourceType: "module", lang: "ts" });
    const program = r === undefined || r.errors.length > 0 ? undefined : r.program;
    cache.set(path, program);
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
  for (const file of manifests) {
    const program = parse(file);
    const obj = program === undefined ? undefined : manifestObject(program);
    if (program === undefined || obj === undefined) {
      open(file);
      continue;
    }
    const acts = attachedElsewhere(file, sources, parse) ? null : attached(program);
    for (const p of obj.properties) {
      const id = p.type === "Property" && !p.computed ? keyName(p.key) : undefined;
      if (p.type !== "Property" || id === undefined) {
        open(`${file} ids`);
        continue;
      }
      routes.set(id, readRoute(id, p.value, { file, program, parse, acts }, unread));
    }
  }
  return { routes: Object.fromEntries(routes), closed, unread };
}
