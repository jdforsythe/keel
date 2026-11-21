import fs from "node:fs";
import path from "node:path";
import { type Argument, type Expression, type Program, parseSync } from "oxc-parser";
import { unwrapExpression } from "./globals/unwrapExpression.ts";
import type { ContractEntryReading } from "./internal/ContractEntryReading.ts";
import type { ContractGap } from "./internal/ContractGap.ts";
import { keyOf } from "./internal/keyOf.ts";
import { literalOf } from "./internal/literalOf.ts";
import { projectManifests } from "./internal/projectManifests.ts";
import { readContract } from "./internal/readContract.ts";
import { unreadModules } from "./internal/unreadModules.ts";
import { stdContract } from "./std/stdContract.ts";
import { stdRoutes } from "./std/stdRoutes.ts";
import type { RouteLiteral } from "./types/RouteLiteral.ts";
import type { RouteLiterals } from "./types/RouteLiterals.ts";
import type { SourceFile } from "./types/SourceFile.ts";
import type { Topology } from "./types/Topology.ts";

const VERBS: readonly string[] = ["DELETE", "PATCH", "POST", "PUT"];

type Field = { value: string | null } | undefined;

/** A string literal (or a template with no expressions), `null` for `null`/`undefined`; undefined when not literal. */
function text(e: Expression): Field {
  const l = literalOf(e);
  return l === undefined || typeof l.value === "boolean" ? undefined : { value: l.value };
}

const isUndefined = (e: Expression): boolean => e.type === "Identifier" && e.name === "undefined";

/**
 * The initializer of the top-level `const <name> = ...` (exported or not) in `program`. A `let` or `var` may be
 * reassigned, so it has none.
 */
function declared(program: Program, name: string): Expression | undefined {
  for (const s of program.body) {
    const decl = s.type === "ExportNamedDeclaration" ? s.declaration : s;
    if (decl === null || decl.type !== "VariableDeclaration" || decl.kind !== "const") continue;
    for (const d of decl.declarations)
      if (d.id.type === "Identifier" && d.id.name === name && d.init !== null) return unwrapExpression(d.init);
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

type At = {
  file: string;
  program: Program;
  parse: Parsed;
  /** The file a package specifier names, for one this reader may follow (a placed stdlib module's `./contract`). */
  resolve: (spec: string) => string | undefined;
};

/**
 * `e` unwrapped and, while an identifier, followed (8 hops at most) to the initializer that binds it: a top-level
 * `const` of `at.file`, else, for a named import from a relative module (or a package specifier `at.resolve` names),
 * the `const` that module exports under the imported name (`exportedLocal`); with the file that initializer is read in. A name it cannot resolve stays an
 * identifier, which every reader takes as unread.
 */
function follow(e: Expression, from: At): [Expression, At] {
  let v = unwrapExpression(e);
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
    const file =
      imp === undefined
        ? undefined
        : imp[0].startsWith(".")
          ? join(at.file.split("/").slice(0, -1).join("/"), imp[0])
          : at.resolve(imp[0]);
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
  const obj = unwrapExpression(decl);
  if (obj.type !== "ObjectExpression") return undefined;
  for (const p of obj.properties) {
    if (p.type !== "Property" || p.computed) return undefined;
    if (keyOf(p) === "redirect") return text(p.value)?.value ?? undefined;
  }
  return null;
}

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
    const k = p.type === "Property" ? (keyOf(p) ?? undefined) : undefined;
    if (p.type === "SpreadElement" ? inner === undefined : k === undefined) return undefined;
    for (const [n, x] of inner ?? []) out.set(n, x);
    if (p.type === "Property" && k !== undefined) out.set(k, [p.value, here]);
  }
  return out;
}

type Mutable = { -readonly [K in keyof RouteLiteral]: RouteLiteral[K] };

/** True when `e` is `null` or `undefined` written out. */
const isNothing = (e: Expression): boolean => (e.type === "Literal" && e.value === null) || isUndefined(e);

/**
 * One contract entry's literal fields (k.contract) from its static reading (`readContract`): its kind (an API entry
 * has `method`, a layout `layout`, else a page), `path` (`null` for a layout), an API entry's `method` and `api: true`,
 * and whether `params` and a page's `search` or an API entry's `query` are declared. `unread` gets each member that is
 * not a literal as `<id> <member>`; an entry with a spread or computed key, which may set any member, is read as
 * nothing and named `<id> <source text>`.
 */
function readEntry(e: ContractEntryReading, text: (g: ContractGap) => string, unread: string[]): Mutable {
  const whole = e.gaps.find((g) => g.part === "spread" || g.part === "key");
  if (whole !== undefined) {
    unread.push(`${e.id} ${text(whole)}`);
    return {};
  }
  for (const g of e.gaps) unread.push(`${e.id} ${g.part}`);
  const out: Mutable = {};
  const api = e.members.has("method");
  const unreadPath = e.gaps.some((g) => g.part === "path");
  if (!api && e.members.has("layout")) out.path = null;
  else if (!unreadPath) {
    const p = e.literals.get("path");
    out.path = typeof p === "string" ? p : null;
  }
  if (api) {
    out.api = true;
    const m = e.literals.get("method");
    if (typeof m === "string") out.method = m;
  }
  const parts = [
    ["params", "params"],
    ["search", api ? "query" : "search"],
  ] as const;
  for (const [field, member] of parts) {
    const x = e.members.get(member)?.value;
    const v = x === undefined ? undefined : unwrapExpression(x);
    if (v !== undefined && v.type === "Literal" && v.value === null) unread.push(`${e.id} ${field}`);
    else out[field] = v !== undefined && !isUndefined(v);
  }
  return out;
}

/**
 * One binding entry's literal fields (k.contract Binding) over its contract entry's `entry`: `layout` (a layout id,
 * `null` without one), guard `redirect` (`null` without a guard or for one without `redirect`) and `actions`: a
 * page's bound verbs, an API write entry's `method`, none for an API GET or a layout. `unread` gets the fields that are
 * not literals; the entry (named by its id) when it is no object literal.
 */
function readBinding(id: string, value: Expression, at: At, entry: Mutable, unread: string[]): Mutable {
  const all = fields(value, at);
  if (all === undefined) {
    unread.push(id);
    return {};
  }
  const out: Mutable = {};
  const l = all.get("layout");
  const t = l === undefined ? { value: null } : text(follow(...l)[0]);
  if (t === undefined) unread.push(`${id} layout`);
  else out.layout = t.value;
  const g = all.get("guard");
  const gv = g === undefined ? undefined : unwrapExpression(g[0]);
  if (gv === undefined || isNothing(gv)) out.guard = null;
  else {
    const redirect = g === undefined ? undefined : guardRedirect(...g);
    if (redirect === undefined) unread.push(`${id} guard`);
    else out.guard = redirect;
  }
  if (entry.api !== true) {
    const verbs = VERBS.filter((v) => {
      const x = all.get(v);
      return x !== undefined && !isUndefined(unwrapExpression(x[0]));
    });
    out.actions = entry.path === null ? [] : verbs;
  } else if (entry.method === undefined) unread.push(`${id} actions`);
  else out.actions = entry.method === "GET" ? [] : [entry.method];
  return out;
}

/** The arguments of `routes = manifest(contract, binding)` in `program` (through `const` aliases), or undefined. */
function manifestCall(program: Program | undefined): [contract: Expression, binding: Expression] | undefined {
  let init = program && declared(program, "routes");
  for (let hop = 0; program && hop < 8 && init?.type === "Identifier"; hop++) init = declared(program, init.name);
  if (init?.type !== "CallExpression" || init.callee.type !== "Identifier" || init.callee.name !== "manifest")
    return undefined;
  const [c, b] = init.arguments;
  if (c === undefined || b === undefined || c.type === "SpreadElement" || b.type === "SpreadElement") return undefined;
  return [c, b];
}

/** The entries argument of `contract('<id>', entries)` that `e` follows to, with the file it is read in; else undefined. */
function contractEntries(e: Expression, at: At): [Argument, At] | undefined {
  const [v, here] = follow(e, at);
  if (v.type !== "CallExpression" || v.callee.type !== "Identifier" || v.callee.name !== "contract") return undefined;
  const arg = v.arguments[1];
  return arg === undefined ? undefined : [arg, here];
}

/**
 * Read a project's route table without evaluating it (k.compiler Artifacts): for each binding `vite build` evaluates
 * (`projectManifests`: an app module's `modules/<id>/routes.ts`, a placed stdlib module's package `./routes` file),
 * its `export const routes = manifest(contract, {...})` and the `contract('<id>', {...})` its first argument names
 * (a `const` of the file, or one a relative module exports; a stdlib binding's is read inside its package, or from
 * its package's `./contract` by specifier), each parsed with oxc. From the contract literal: ids, `path`, an API
 * entry's `method` (`api: true`), `params` and `search` (an API entry's `query`) presence; from the binding literal:
 * `layout`, the verbs a page binds (an API write entry's `actions` is its `method`) and a guard's `redirect` (a
 * `guard({ redirect: "..." }, fn)` of the file or imported from a relative module; `null` for one without). `file`
 * is the contract file, project-relative, or a stdlib module's `./contract` specifier. The contract is read as
 * `readContract` reads it, as E1111 does: nothing in it is followed but its schemas. Anything not literal is named in
 * `unread` (W1005): a member as `<id> <member>`, an entry that is no object literal or holds a spread or computed key
 * as `<id> <source text>`, entries that are no object literal or a spread among them as `<file> <source text>`, a
 * computed id as `<file> ids`, a binding field as `<id> <field>`, a binding entry as `<id>`, a binding spread by its
 * source text, a binding or contract not read as `<file>` or `<file> contract`, a placed module that resolves to none
 * (`unreadModules`) as its id. Any part of a contract not read, a binding spread or computed key, or a binding not
 * read opens the id set (`closed: false`); a spread or computed key, since it may override them, also unreads that
 * module's routes before it. Undefined when there is no binding: `routes.json` is then `{}` and compared by hash.
 * `files` are project files relative to `root` (default `process.cwd()`), the directory packages resolve from.
 */
export function routeLiterals(
  files: readonly SourceFile[],
  options: { readonly topology?: Topology | undefined; readonly root?: string | undefined } = {},
): RouteLiterals | undefined {
  const root = options.root ?? process.cwd();
  const paths = files.map((f) => f.path);
  const manifests = projectManifests(options.topology, paths, root);
  const missing = unreadModules(options.topology, paths, root);
  if (manifests.length === 0 && missing.length === 0) return undefined;
  /** A placed stdlib module's binding file: its import specifier and package directory. */
  const std = new Map<string, [spec: string, pkg: string]>();
  /** A placed stdlib module's `./contract` specifier to its file. */
  const contracts = new Map<string, string>();
  for (const d of Object.values(options.topology ?? {}))
    for (const m of d.modules) {
      const at = stdRoutes(root, m);
      if (at !== undefined) std.set(at[0], [at[2], at[1]]);
      const c = stdContract(root, m);
      if (c !== undefined) contracts.set(c[2], c[0]);
    }
  const sources = new Map(files.map((f) => [f.path, f.source]));
  /** A project file's text, or an absolute file's a package binding reads. */
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
  for (const file of manifests) {
    const [spec, pkg] = std.get(file) ?? [];
    const name = spec ?? file;
    const within: Parsed = (p) => {
      try {
        return pkg === undefined || fs.realpathSync(p).startsWith(pkg + path.sep) ? parse(p) : undefined;
      } catch {
        return undefined;
      }
    };
    const program = parse(file);
    const call = manifestCall(program);
    const at: At | undefined = program && { file, program, parse: within, resolve: (s) => contracts.get(s) };
    const read = call && at && contractEntries(call[0], at);
    if (at === undefined || call === undefined || read === undefined) {
      closed = false;
      unread.push(call === undefined ? name : `${name} contract`);
      continue;
    }
    const [entries, cat] = read;
    const where = spec === undefined ? cat.file : spec.replace(/\/routes$/, "/contract");
    /** This module's entries as read so far. */
    const own = new Map<string, Mutable>();
    /** Ids a contract part may override: their entry is unknown and their binding is not read. */
    const opaque = new Set<string>();
    /** Ids bound so far. */
    const bound = new Set<string>();
    /**
     * A part whose ids or members are unknown: open the id set, and unread the routes before it that the part may
     * override (in the contract, every entry read so far; in the binding, every id bound so far).
     */
    const open = (part: string, binding: boolean): void => {
      closed = false;
      for (const [id, { layout, guard, actions, ...e }] of own) {
        if (binding && !bound.has(id)) continue;
        if (binding) own.set(id, e);
        else {
          own.set(id, {});
          opaque.add(id);
        }
        if (!unread.includes(id)) unread.push(id);
      }
      unread.push(part);
    };
    /** A part by its source text, the file named by its specifier when it is a stdlib package's. */
    const source = (f: string, node: { start: number; end: number }): string =>
      `${f === file ? name : f === cat.file ? where : f} ${textOf(f)?.slice(node.start, node.end) ?? ""}`;
    const before = unread.length;
    const text = (g: ContractGap): string => textOf(cat.file)?.slice(g.start, g.end) ?? "";
    for (const g of readContract(entries)) {
      if (g.kind === "entry") own.set(g.id, readEntry(g, text, unread));
      else if (g.part === "key") open(`${where} ids`, false);
      else if (g.id === null) open(source(cat.file, g), false);
      else {
        own.set(g.id, {});
        unread.push(`${g.id} ${text(g)}`);
      }
    }
    if (unread.length > before) closed = false;
    const [bv, bat] = follow(call[1], at);
    if (bv.type !== "ObjectExpression") open(name, true);
    else
      for (const p of bv.properties) {
        if (p.type === "SpreadElement") {
          open(source(bat.file, p), true);
          continue;
        }
        const id = keyOf(p) ?? undefined;
        const entry = id === undefined || opaque.has(id) ? undefined : own.get(id);
        if (id === undefined) open(`${name} ids`, true);
        else if (entry !== undefined) {
          bound.add(id);
          own.set(id, { ...entry, ...readBinding(id, p.value, bat, entry, unread) });
        }
      }
    for (const [id, e] of own) routes.set(id, { ...e, file: where });
  }
  if (missing.length > 0) closed = false;
  unread.push(...missing);
  return { routes: Object.fromEntries(routes), closed, unread };
}
