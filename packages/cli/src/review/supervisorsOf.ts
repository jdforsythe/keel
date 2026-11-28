import { type Program, type Statement, parseSync } from "oxc-parser";
import type { Snapshot } from "./Snapshot.ts";

/** Re-exports followed from a library's entry before the name is given up on. */
const DEPTH = 8;
/** A library's `package.json` (k.library Kind): marked `"keel": "library"` under a scoped name, or a stdlib package. */
const SCOPED = /^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/;
const STD = /^@keel\/std-[a-z0-9-]+$/;
const isLibrary = (pkg: object, name: string): boolean =>
  (Reflect.get(pkg, "keel") === "library" && SCOPED.test(name)) || STD.test(name);
const CONDITIONS = ["keel", "import", "default"];
const EXTENSIONS = ["", ".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.js"];

/** The parsed JSON of `text`, or undefined. */
function json(text: string | undefined): unknown {
  if (text === undefined) return undefined;
  try {
    const v: unknown = JSON.parse(text);
    return v;
  } catch {
    return undefined;
  }
}

/** The file an `exports` target names: itself when a string, else its `keel`, `import` or `default` condition. */
function target(t: unknown): string | undefined {
  if (typeof t === "string") return t;
  if (typeof t !== "object" || t === null || Array.isArray(t)) return undefined;
  for (const c of CONDITIONS) {
    const found = target(Reflect.get(t, c));
    if (found !== undefined) return found;
  }
  return undefined;
}

/** `a/b/../c` as `a/c`. */
function normal(p: string): string {
  const out: string[] = [];
  for (const s of p.split("/")) {
    if (s === "..") out.pop();
    else if (s !== "." && s !== "") out.push(s);
  }
  return out.join("/");
}

/** Whether `c`, a callee, is `supervise`, bare or as a non-computed member. */
function isSupervise(c: unknown): boolean {
  if (typeof c !== "object" || c === null) return false;
  if (Reflect.get(c, "type") === "Identifier") return Reflect.get(c, "name") === "supervise";
  const p: unknown = Reflect.get(c, "property");
  return (
    Reflect.get(c, "type") === "MemberExpression" &&
    Reflect.get(c, "computed") === false &&
    typeof p === "object" &&
    p !== null &&
    Reflect.get(p, "name") === "supervise"
  );
}

/** Whether a node (a function) holds a `supervise` call, nested functions included. */
function supervises(node: unknown): boolean {
  if (typeof node !== "object" || node === null) return false;
  if (Array.isArray(node)) return node.some(supervises);
  if (Reflect.get(node, "type") === "CallExpression" && isSupervise(Reflect.get(node, "callee"))) return true;
  return Object.values(node).some((v) => typeof v === "object" && v !== null && supervises(v));
}

/**
 * For one snapshot (k.escapes R1018, one hop): given an import specifier and the name a file imports from it, the path
 * of the library file whose function of that name holds a `supervise` call, else undefined. The specifier is a library
 * of the tree: a package folder outside `node_modules/` whose `package.json` marks it a library (k.library) or names a
 * stdlib package. Its `exports` entry is read at `keel`, `import` or `default`, and the name is followed through
 * `export { a as b } from`, `export *` and a local `export { a }` to a function declaration, or a `const` bound to an
 * arrow or a function expression, in up to eight files.
 */
export function supervisorsOf(snap: Snapshot): (spec: string, name: string) => string | undefined {
  let folders: Map<string, { readonly dir: string; readonly exports: unknown }> | undefined;
  const programs = new Map<string, Program | null>();
  const held = new Map<string, string | undefined>();
  const has = new Set(snap.paths);

  const libraries = () => {
    if (folders !== undefined) return folders;
    folders = new Map();
    for (const p of snap.paths) {
      if (!/(?:^|\/)package\.json$/.test(p) || /(?:^|\/)node_modules\//.test(p)) continue;
      const pkg = json(snap.text(p));
      const name = typeof pkg === "object" && pkg !== null ? Reflect.get(pkg, "name") : undefined;
      if (
        typeof name !== "string" ||
        typeof pkg !== "object" ||
        pkg === null ||
        !isLibrary(pkg, name) ||
        folders.has(name)
      )
        continue;
      folders.set(name, { dir: p.slice(0, -"package.json".length), exports: Reflect.get(Object(pkg), "exports") });
    }
    return folders;
  };

  const parsed = (path: string): Program | null => {
    const held = programs.get(path);
    if (held !== undefined) return held;
    const text = snap.text(path);
    const r =
      text === undefined ? null : parseSync(path, text, { sourceType: "module", lang: /x$/.test(path) ? "tsx" : "ts" });
    const program = r === null || r.errors.length > 0 ? null : r.program;
    programs.set(path, program);
    return program;
  };

  const file = (from: string, spec: string): string | undefined => {
    const base = normal(`${from.slice(0, from.lastIndexOf("/") + 1)}${spec}`);
    for (const e of EXTENSIONS) if (has.has(`${base}${e}`)) return `${base}${e}`;
    return undefined;
  };

  /** The file of `path` whose function `name` it exports supervises, following re-exports. */
  const follow = (path: string, name: string, depth: number): string | undefined => {
    const program = depth > DEPTH ? null : parsed(path);
    if (program === null) return undefined;
    const local = (n: string): boolean => {
      for (const st of program.body) if (declares(st, n)) return true;
      return false;
    };
    const declares = (st: Statement, n: string): boolean => {
      const d = st.type === "ExportNamedDeclaration" || st.type === "ExportDefaultDeclaration" ? st.declaration : st;
      if (d === null || d === undefined) return false;
      if (d.type === "FunctionDeclaration" && d.id?.name === n) return supervises(d);
      if (d.type !== "VariableDeclaration") return false;
      for (const v of d.declarations)
        if (v.id.type === "Identifier" && v.id.name === n && v.init !== null)
          if (v.init.type === "ArrowFunctionExpression" || v.init.type === "FunctionExpression")
            return supervises(v.init);
      return false;
    };
    for (const st of program.body) {
      if (st.type === "ExportDefaultDeclaration" && name === "default") {
        const d = st.declaration;
        if (d.type === "FunctionDeclaration" || d.type === "ArrowFunctionExpression" || d.type === "FunctionExpression")
          return supervises(d) ? path : undefined;
        if (d.type === "Identifier") return local(d.name) ? path : undefined;
      }
      if (st.type === "ExportNamedDeclaration") {
        if (st.declaration !== null && st.declaration !== undefined && declares(st, name)) return path;
        for (const sp of st.specifiers) {
          const exported = sp.exported.type === "Identifier" ? sp.exported.name : sp.exported.value;
          if (exported !== name) continue;
          const inner = sp.local.type === "Identifier" ? sp.local.name : sp.local.value;
          if (st.source === null) return local(inner) ? path : undefined;
          const next = file(path, st.source.value);
          return next === undefined ? undefined : follow(next, inner, depth + 1);
        }
      }
      if (st.type === "ExportAllDeclaration" && st.exported === null) {
        const next = file(path, st.source.value);
        const found = next === undefined ? undefined : follow(next, name, depth + 1);
        if (found !== undefined) return found;
      }
    }
    return undefined;
  };

  return (spec, name) => {
    const key = `${spec}\u0000${name}`;
    if (held.has(key)) return held.get(key);
    const m = /^(@[^/]+\/[^/]+)(\/.+)?$/.exec(spec);
    const lib = m === null ? undefined : libraries().get(m[1] ?? "");
    let found: string | undefined;
    if (m !== null && lib !== undefined) {
      const sub = `.${m[2] ?? ""}`;
      const ex = lib.exports;
      const sugar =
        typeof ex === "string" ||
        (typeof ex === "object" && ex !== null && !Object.keys(ex).some((k) => k.startsWith(".")));
      const entry = target(
        sugar
          ? sub === "."
            ? ex
            : undefined
          : typeof ex === "object" && ex !== null
            ? Reflect.get(ex, sub)
            : undefined,
      );
      const at = entry === undefined ? undefined : normal(`${lib.dir}${entry}`);
      found = at === undefined || !has.has(at) ? undefined : follow(at, name, 0);
    }
    held.set(key, found);
    return found;
  };
}
