import { posix } from "node:path";
import type { Argument, CallExpression, Program } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import type { Checked } from "./Checked.ts";
import type { FileOf } from "./functionRead/FileOf.ts";
import { READ_DEPTH } from "./functionRead/READ_DEPTH.ts";
import { parseFile } from "./parseFile.ts";

/**
 * An occurrence of a binding that may hold a registering library export: a call (judged by `arg`), a use as a value,
 * or a use of a binding reached through more files than the trace reads (`deep`).
 */
type Use =
  | { readonly kind: "call"; readonly call: CallExpression; readonly name: string; readonly arg: Argument | undefined }
  | { readonly kind: "value" | "deep"; readonly at: number; readonly name: string };

/** A node of the tree, as the trace sees it. */
type Node = { readonly type: string; readonly start: number; readonly end: number };
/** What a binding may hold: the export (`index`: the parameter its `register` reads), a namespace holding one, or unknown past the bound. */
type Target =
  | { readonly kind: "fn"; readonly index: number }
  | { readonly kind: "ns"; readonly entry: SourceFile; readonly depth: number }
  | { readonly kind: "deep" };

const DEEP: Target = { kind: "deep" };
const isNode = (x: unknown): x is Node =>
  typeof x === "object" &&
  x !== null &&
  typeof Reflect.get(x, "type") === "string" &&
  typeof Reflect.get(x, "start") === "number";
const field = (n: unknown, k: string): unknown => (isNode(n) ? Reflect.get(n, k) : undefined);
const nameOf = (n: unknown): string | undefined =>
  isNode(n) && n.type === "Identifier" ? String(field(n, "name")) : undefined;
const keyName = (n: unknown): string | undefined => {
  const v = field(n, "value");
  return nameOf(n) ?? (isNode(n) && n.type === "Literal" && typeof v === "string" ? v : undefined);
};
const isCall = (n: Node): n is CallExpression => n.type === "CallExpression";
const list = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
/** Positions that carry no value: a name there is no occurrence. */
const TYPES = new Set([
  "TSTypeQuery",
  "TSTypeReference",
  "TSTypeAnnotation",
  "TSQualifiedName",
  "TSTypeParameterInstantiation",
  "TSImportType",
]);
const FUNCTIONS = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"]);

/** `(x)` read through. */
function bare(n: unknown): unknown {
  let x = n;
  while (isNode(x) && x.type === "ParenthesizedExpression") x = field(x, "expression");
  return x;
}

/** The literal specifier of `import('<spec>')` (a string, or a template without an expression), else undefined. */
function importSpec(n: unknown): string | undefined {
  const src = field(n, "source");
  const v = field(src, "value");
  if (isNode(src) && src.type === "Literal" && typeof v === "string") return v;
  const quasis = list(field(src, "quasis"));
  if (!isNode(src) || src.type !== "TemplateLiteral" || list(field(src, "expressions")).length > 0) return undefined;
  const value: unknown =
    typeof quasis[0] === "object" && quasis[0] !== null ? Reflect.get(quasis[0], "value") : undefined;
  const cooked: unknown = typeof value === "object" && value !== null ? Reflect.get(value, "cooked") : undefined;
  return typeof cooked === "string" ? cooked : undefined;
}

/** The names a binding pattern declares. */
function patternNames(p: unknown): string[] {
  const n = nameOf(p);
  if (n !== undefined) return [n];
  if (!isNode(p)) return [];
  if (p.type === "AssignmentPattern") return patternNames(field(p, "left"));
  if (p.type === "RestElement") return patternNames(field(p, "argument"));
  if (p.type === "ArrayPattern") return list(field(p, "elements")).flatMap(patternNames);
  if (p.type === "ObjectPattern")
    return list(field(p, "properties")).flatMap((q) => patternNames(field(q, "value") ?? q));
  return [];
}

/**
 * The trace of the bindings that may hold a library export whose `register` name is its parameter (k.server-deps
 * Registration through a library), over the files `fileOf` finds; `params` keys such a function by `<path>:<start>`.
 * A file counts toward `READ_DEPTH` (8) as the trace enters it, the calling file first; a binding reached past it holds
 * `deep`.
 */
function tracer(fileOf: FileOf, params: ReadonlyMap<string, number>) {
  const fnAt = (file: SourceFile, n: unknown): Target | undefined => {
    const x = bare(n);
    if (!isNode(x) || !FUNCTIONS.has(x.type)) return undefined;
    const index = params.get(`${file.path}:${x.start}`);
    return index === undefined ? undefined : { kind: "fn", index };
  };
  const holds = new Map<string, boolean>();
  /** Whether a namespace of `entry` holds a registering export, or one past the bound. */
  const registers = (entry: SourceFile, depth: number): boolean => {
    const known = holds.get(entry.path);
    if (known !== undefined) return known;
    holds.set(entry.path, false);
    const hit = exportNames(entry, depth).some((n) => exported(entry, n, depth) !== undefined);
    holds.set(entry.path, hit);
    return hit;
  };
  const namespace = (from: SourceFile, spec: string, depth: number): Target | undefined => {
    if (depth > READ_DEPTH) return DEEP;
    const entry = fileOf(from, spec);
    return entry !== undefined && registers(entry, depth) ? { kind: "ns", entry, depth } : undefined;
  };
  /** The export names of `file`, `export *` followed. */
  const exportNames = (file: SourceFile, depth: number): string[] => {
    if (depth > READ_DEPTH) return [];
    const out: string[] = [];
    for (const st of parseFile(file).program.body) {
      if (st.type === "ExportDefaultDeclaration") out.push("default");
      if (st.type === "ExportAllDeclaration") {
        const next = fileOf(file, st.source.value);
        if (st.exported !== null) out.push(keyName(st.exported) ?? "");
        else if (next !== undefined) out.push(...exportNames(next, depth + 1));
      }
      if (st.type !== "ExportNamedDeclaration") continue;
      for (const sp of st.specifiers) out.push(keyName(sp.exported) ?? "");
      out.push(...patternNames(field(st.declaration, "id")));
      for (const v of list(field(st.declaration, "declarations"))) out.push(...patternNames(field(v, "id")));
    }
    return out;
  };
  /** What a `const` initializer `init` in `file` holds, `local` resolving the file's own names. */
  const initOf = (
    file: SourceFile,
    init: unknown,
    depth: number,
    local: (n: string) => Target | undefined,
  ): Target | undefined => {
    const x = bare(init);
    const fn = fnAt(file, x);
    if (fn !== undefined) return fn;
    const n = nameOf(x);
    if (n !== undefined) return local(n);
    if (isNode(x) && x.type === "AwaitExpression") {
      const arg = bare(field(x, "argument"));
      const spec = isNode(arg) && arg.type === "ImportExpression" ? importSpec(arg) : undefined;
      return spec === undefined ? undefined : namespace(file, spec, depth + 1);
    }
    if (isNode(x) && x.type === "MemberExpression" && field(x, "computed") !== true) {
      const of: Target | undefined = initOf(file, field(x, "object"), depth, local);
      const prop = nameOf(field(x, "property"));
      return of?.kind === "ns" && prop !== undefined ? exported(of.entry, prop, of.depth) : of;
    }
    return undefined;
  };
  /** What the top-level name `name` of `file` (entered at `depth`) holds. */
  const topLocal = (file: SourceFile, name: string, depth: number): Target | undefined => {
    const program = parseFile(file).program;
    for (const st of program.body) {
      if (st.type === "ImportDeclaration" && st.importKind !== "type")
        for (const sp of st.specifiers) {
          if (sp.local.name !== name) continue;
          if (sp.type === "ImportNamespaceSpecifier") return namespace(file, st.source.value, depth + 1);
          if (sp.type === "ImportSpecifier" && sp.importKind === "type") return undefined;
          const imported = sp.type === "ImportSpecifier" ? (keyName(sp.imported) ?? "") : "default";
          const next = fileOf(file, st.source.value);
          return next === undefined ? undefined : exported(next, imported, depth + 1);
        }
      if (st.type === "TSImportEqualsDeclaration" && st.id.name === name)
        return st.moduleReference.type === "TSExternalModuleReference"
          ? namespace(file, st.moduleReference.expression.value, depth + 1)
          : undefined;
      const d = st.type === "ExportNamedDeclaration" ? st.declaration : st;
      if (d?.type === "FunctionDeclaration" && d.id?.name === name) return fnAt(file, d);
      if (d?.type !== "VariableDeclaration") continue;
      for (const v of d.declarations) {
        if (nameOf(v.id) === name)
          return d.kind === "const" ? initOf(file, v.init, depth, (n) => topLocal(file, n, depth)) : undefined;
        if (v.id.type !== "ObjectPattern" || d.kind !== "const") continue;
        for (const p of v.id.properties)
          if (p.type === "Property" && nameOf(p.value) === name && !p.computed) {
            const of = initOf(file, v.init, depth, (n) => topLocal(file, n, depth));
            const key = keyName(p.key);
            return of?.kind === "ns" && key !== undefined ? exported(of.entry, key, of.depth) : of;
          }
      }
    }
    return undefined;
  };
  /** What the export `name` of `file` (entered at `depth`) holds. */
  const exported = (file: SourceFile, name: string, depth: number): Target | undefined => {
    if (depth > READ_DEPTH) return DEEP;
    for (const st of parseFile(file).program.body) {
      if (st.type === "ExportDefaultDeclaration" && name === "default") {
        const d = st.declaration;
        return fnAt(file, d) ?? (nameOf(d) === undefined ? undefined : topLocal(file, nameOf(d) ?? "", depth));
      }
      if (st.type === "ExportAllDeclaration") {
        if (st.exported !== null && keyName(st.exported) === name) return namespace(file, st.source.value, depth + 1);
        if (st.exported !== null || name === "default") continue;
        const next = fileOf(file, st.source.value);
        const hit = next === undefined ? undefined : exported(next, name, depth + 1);
        if (hit !== undefined) return hit;
      }
      if (st.type !== "ExportNamedDeclaration") continue;
      if (st.declaration !== null && st.declaration !== undefined) {
        if (patternNames(field(st.declaration, "id")).includes(name)) return topLocal(file, name, depth);
        for (const v of list(field(st.declaration, "declarations")))
          if (patternNames(field(v, "id")).includes(name)) return topLocal(file, name, depth);
        continue;
      }
      for (const sp of st.specifiers) {
        if (keyName(sp.exported) !== name) continue;
        const local = keyName(sp.local) ?? "";
        if (st.source === null) return topLocal(file, local, depth);
        const next = fileOf(file, st.source.value);
        return next === undefined ? undefined : exported(next, local, depth + 1);
      }
    }
    return undefined;
  };
  return { topLocal, initOf, exported, namespace, fnAt };
}

/**
 * Every occurrence in `checked` of a binding that may hold a library export whose `register` name is its parameter
 * (`params`; k.server-deps Registration through a library). The bindings: an import of it under any name, a namespace
 * import (`import * as`, `import x = require`) or an imported namespace (`export * as`) of a module holding one, its
 * declaration, a `const` alias or plain-keyed `const` destructuring of any of these, and a directly awaited literal
 * `import()` of such a module, followed across files through re-exports under any name, `export *` and `export * as`,
 * at most `READ_DEPTH` files deep, the calling file counted. Each occurrence is exactly one of: a further binding (a
 * `const` declaration, a plain key of a `const` destructuring, an `export { x }` or `export default x`, a static member
 * of a namespace read on); a call whose argument is judged (`call`); or a `value` (any other position, a member such as
 * `.call` or a computed key, a rest, a defaulted key, an optional call, `new`, a tagged template, an argument, a return,
 * a literal, a spread, a conditional); a binding past the depth gives `deep` at each occurrence. A name in a type
 * position, a parameter or a declaration is no occurrence; a parameter of the same name hides the binding in its function.
 */
export function libraryUses(
  checked: Checked,
  fileOf: FileOf,
  params: ReadonlyMap<string, number>,
  files: readonly SourceFile[] = [],
): Use[] {
  const program: Program = checked.parsed.program;
  const file = checked.file;
  const t = tracer(fileOf, params);
  const bound = new Map<string, Target>();
  const local = (n: string): Target | undefined => bound.get(n) ?? t.topLocal(file, n, 1);
  for (const n of new Set(topNames(program))) {
    const hit = t.topLocal(file, n, 1);
    if (hit !== undefined) bound.set(n, hit);
  }
  // Inner `const` bindings, to a fixed point: an alias, a member of a namespace, an awaited `import()`, a destructuring.
  for (let grew = true; grew; ) {
    grew = false;
    walk(program.body, (n) => {
      if (n.type !== "VariableDeclaration" || field(n, "kind") !== "const") return;
      for (const v of list(field(n, "declarations"))) {
        const id = field(v, "id");
        const of = t.initOf(file, field(v, "init"), 1, local);
        if (of === undefined) continue;
        const name = nameOf(id);
        if (name !== undefined && !bound.has(name)) {
          bound.set(name, of);
          grew = true;
        }
        if (of.kind !== "ns" || !isNode(id) || id.type !== "ObjectPattern") continue;
        for (const p of list(field(id, "properties"))) {
          const key = field(p, "computed") === true ? undefined : keyName(field(p, "key"));
          const to = nameOf(field(p, "value"));
          const held = key === undefined ? undefined : t.exported(of.entry, key, of.depth);
          if (to !== undefined && held !== undefined && !bound.has(to)) {
            bound.set(to, held);
            grew = true;
          }
        }
      }
    });
  }
  // The name a message shows for a binding: an alias shows what it aliases, a destructured or member binding its key.
  const declarators: unknown[] = [];
  walk(program.body, (n) => {
    if (n.type === "VariableDeclarator") declarators.push(n);
  });
  const shownOf = (name: string, seen: ReadonlySet<string> = new Set()): string => {
    if (seen.has(name)) return name;
    for (const v of declarators) {
      const id = field(v, "id");
      const init = bare(field(v, "init"));
      if (nameOf(id) === name) {
        const from = nameOf(init);
        if (from !== undefined && bound.has(from)) return shownOf(from, new Set([...seen, name]));
        const prop = isNode(init) && init.type === "MemberExpression" ? nameOf(field(init, "property")) : undefined;
        return prop ?? name;
      }
      for (const p of isNode(id) && id.type === "ObjectPattern" ? list(field(id, "properties")) : [])
        if (nameOf(field(p, "value")) === name) return keyName(field(p, "key")) ?? name;
    }
    return name;
  };
  const out: Use[] = [];
  const flag = (target: Target | undefined, at: number, name: string): void =>
    void out.push({ kind: target?.kind === "deep" ? "deep" : "value", at, name });
  /** Classify `node`, which holds `target` (shown as `name`), by where it stands. */
  const classify = (node: Node, target: Target, name: string, up: readonly Node[]): void => {
    let at = up.length - 1;
    let self: Node = node;
    while (up[at]?.type === "ParenthesizedExpression") {
      self = up[at] ?? self;
      at -= 1;
    }
    const parent = up[at];
    if (parent === undefined) {
      flag(target, node.start, name);
      return;
    }
    const key =
      Object.keys(parent).find((k) => Reflect.get(parent, k) === self || list(Reflect.get(parent, k)).includes(self)) ??
      "";
    const pt = parent.type;
    if (pt === "ExportSpecifier" || pt === "ExportDefaultDeclaration") return;
    if (pt === "VariableDeclarator" && key === "init") {
      const decl = up[at - 1];
      const id = field(parent, "id");
      // An exported `const` alias is a value: the trace continues through a re-export (`export { x as y }`), not it.
      if (up[at - 2]?.type === "ExportNamedDeclaration") {
        flag(target, node.start, name);
        return;
      }
      if (field(decl, "kind") === "const" && nameOf(id) !== undefined) return;
      if (field(decl, "kind") === "const" && isNode(id) && id.type === "ObjectPattern" && target.kind === "ns") {
        pattern(id, target, name);
        return;
      }
      flag(target, node.start, name);
      return;
    }
    if (
      target.kind === "fn" &&
      pt === "CallExpression" &&
      key === "callee" &&
      field(parent, "optional") !== true &&
      isCall(parent)
    )
      return void out.push({ kind: "call", call: parent, name, arg: parent.arguments[target.index] });
    if (target.kind === "ns" && pt === "MemberExpression" && key === "object" && field(parent, "computed") !== true) {
      const prop = nameOf(field(parent, "property"));
      const held = prop === undefined ? undefined : t.exported(target.entry, prop, target.depth);
      if (held !== undefined && prop !== undefined) classify(parent, held, prop, up.slice(0, at));
      return;
    }
    flag(target, node.start, name);
  };
  /** A `const` destructuring of namespace `ns`: a plain key binds on; a rest, computed or defaulted key that may hold one is a value. */
  const pattern = (id: Node, ns: Extract<Target, { kind: "ns" }>, name: string): void => {
    for (const p of list(field(id, "properties"))) {
      if (!isNode(p)) continue;
      if (p.type === "RestElement" || field(p, "computed") === true) {
        flag(ns, p.start, name);
        continue;
      }
      const key = keyName(field(p, "key"));
      const held = key === undefined ? undefined : t.exported(ns.entry, key, ns.depth);
      if (held !== undefined && nameOf(field(p, "value")) === undefined) flag(held, p.start, key ?? name);
    }
  };
  /**
   * What a computed `import()` may reach: with a relative template (`./dir/${x}.ts`), the project files under that
   * folder with that ending, `deep` when one holds a registering export and nothing otherwise; any other: `deep`.
   */
  const reachable = (n: Node): Target | undefined => {
    const src = field(n, "source");
    const quasis = list(field(src, "quasis")).map((q) => field(q, "value"));
    const text = (v: unknown): string | undefined => {
      const c: unknown = typeof v === "object" && v !== null ? Reflect.get(v, "cooked") : undefined;
      return typeof c === "string" ? c : undefined;
    };
    const head = text(quasis[0]);
    const tail = text(quasis[quasis.length - 1]) ?? "";
    if (!isNode(src) || src.type !== "TemplateLiteral" || head === undefined || !head.startsWith(".")) return DEEP;
    const dir = file.path.slice(0, file.path.lastIndexOf("/") + 1);
    const prefix = posix.normalize(`${dir}${head}`);
    const hits = files.filter((f) => f.path.startsWith(prefix) && f.path.endsWith(tail) && f.path !== file.path);
    return hits.some((f) => t.namespace(file, `./${posix.relative(posix.dirname(file.path), f.path)}`, 2) !== undefined)
      ? DEEP
      : undefined;
  };
  const hidden: Set<string>[] = [];
  walk(
    program.body,
    (n, up, key) => {
      if (up.some((a) => TYPES.has(a.type))) return;
      if (n.type === "ImportExpression") {
        const spec = importSpec(n);
        const ns = spec === undefined ? reachable(n) : t.namespace(file, spec, 2);
        if (ns === undefined) return;
        if (ns.kind !== "ns" || up[up.length - 1]?.type !== "AwaitExpression") {
          flag(undefined, n.start, "import()");
          return;
        }
        const awaited = up[up.length - 1];
        return awaited === undefined ? undefined : classify(awaited, ns, "import()", up.slice(0, -1));
      }
      const name = nameOf(n);
      const target = name === undefined ? undefined : bound.get(name);
      if (name === undefined || target === undefined || hidden.some((h) => h.has(name))) return;
      const parent = up[up.length - 1];
      const pt = parent?.type ?? "";
      // Declarations and names that are not references: no occurrence.
      if (pt === "ImportSpecifier" || pt === "ImportDefaultSpecifier" || pt === "ImportNamespaceSpecifier") return;
      if (pt === "TSImportEqualsDeclaration" || (pt === "ExportSpecifier" && key === "exported")) return;
      if (
        (pt === "MemberExpression" || pt === "Property" || pt === "PropertyDefinition" || pt === "MethodDefinition") &&
        key !== "object" &&
        key !== "value" &&
        field(parent, "computed") !== true
      )
        return;
      if (pt === "Property" && key === "value" && up.some((a) => a.type === "ObjectPattern")) return;
      if ((pt === "VariableDeclarator" && key === "id") || (FUNCTIONS.has(pt) && key === "id")) return;
      if (pt === "ClassDeclaration" || pt === "TSEnumMember" || pt === "LabeledStatement") return;
      classify(n, target, shownOf(name), up);
    },
    (fn) => {
      const names = new Set(
        list(field(fn, "params"))
          .flatMap(patternNames)
          .filter((p) => bound.has(p)),
      );
      hidden.push(names);
      return () => void hidden.pop();
    },
  );
  return out;
}

/** The top-level names `program` binds: imports and declarations. */
function topNames(program: Program): string[] {
  const out: string[] = [];
  for (const st of program.body) {
    if (st.type === "ImportDeclaration") for (const sp of st.specifiers) out.push(sp.local.name);
    if (st.type === "TSImportEqualsDeclaration") out.push(st.id.name);
    const d = st.type === "ExportNamedDeclaration" ? st.declaration : st;
    if (d?.type === "FunctionDeclaration" && d.id !== null && d.id !== undefined) out.push(d.id.name);
    if (d?.type === "VariableDeclaration") for (const v of d.declarations) out.push(...patternNames(v.id));
  }
  return out;
}

/**
 * Each node of `root` with its ancestors (the parent last) and the parent's key holding it, depth first in source
 * order; `enter` is told of each
 * function before its children and returns what runs after them.
 */
function walk(
  root: unknown,
  visit: (n: Node, up: readonly Node[], key: string) => void,
  enter: (fn: Node) => () => void = () => () => undefined,
): void {
  const up: Node[] = [];
  const go = (x: unknown, key: string): void => {
    if (Array.isArray(x)) {
      for (const el of x) go(el, key);
      return;
    }
    if (!isNode(x)) return;
    visit(x, up, key);
    const leave = FUNCTIONS.has(x.type) ? enter(x) : undefined;
    up.push(x);
    for (const k of Object.keys(x)) if (k !== "type" && k !== "start" && k !== "end") go(Reflect.get(x, k), k);
    up.pop();
    leave?.();
  };
  go(root, "");
}
