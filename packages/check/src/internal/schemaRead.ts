import {
  type Argument,
  type ArrowFunctionExpression,
  type CallExpression,
  type Expression,
  type Function as FunctionNode,
  type ParamPattern,
  Visitor,
} from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import type { SchemaAnswer } from "./SchemaAnswer.ts";
import type { SchemaQuestion } from "./SchemaQuestion.ts";
import { followRef } from "./followRef.ts";
import { held } from "./held.ts";
import { importTarget } from "./importTarget.ts";
import { isAstNode } from "./isAstNode.ts";
import { packageSource } from "./packageSource.ts";
import { parseFile } from "./parseFile.ts";

const MAX_DEPTH = 8;
/** The package whose exports are the schema constructors themselves, read by their receiver and arguments. */
const SCHEMA = "@keel/schema";

type Fn = FunctionNode | ArrowFunctionExpression;
/** Inside a package function: its parameters (read at the call), its body's top-level `const`s, the depth. */
type Scope = { readonly params: ReadonlySet<string>; readonly locals: ReadonlyMap<string, Expression> };
/** `active`: the package functions being read on the way here, so a cycle among them is not read as finished. */
type Ctx = {
  readonly app: readonly SourceFile[];
  readonly scope: Scope | undefined;
  readonly depth: number;
  readonly active: ReadonlySet<string>;
};

const worst = (a: SchemaAnswer, b: SchemaAnswer): SchemaAnswer =>
  a === "yes" || b === "yes" ? "yes" : a === "unknown" || b === "unknown" ? "unknown" : "no";

const unwrap = (e: Expression): Expression =>
  e.type === "ParenthesizedExpression" || e.type === "TSAsExpression" || e.type === "TSSatisfiesExpression"
    ? unwrap(e.expression)
    : e;

/** The names a parameter pattern binds, and the default values it holds. */
function bound(p: unknown, names: Set<string>, defaults: unknown[]): void {
  if (!isAstNode(p)) return;
  if (p.type === "Identifier" && typeof p.name === "string") names.add(p.name);
  else if (p.type === "AssignmentPattern") {
    bound(p.left, names, defaults);
    defaults.push(p.right);
  } else if (p.type === "RestElement") bound(p.argument, names, defaults);
  else if (p.type === "TSParameterProperty") bound(p.parameter, names, defaults);
  else if (p.type === "ArrayPattern" && Array.isArray(p.elements))
    for (const e of p.elements) bound(e, names, defaults);
  else if (p.type === "ObjectPattern" && Array.isArray(p.properties))
    for (const q of p.properties)
      bound(isAstNode(q) && q.type === "RestElement" ? q.argument : isAstNode(q) ? q.value : q, names, defaults);
}

/** The function `name` is in `file` at the top level (a declaration with a body, or a `const` bound to one), or through a relative import. */
function localFunction(
  name: string,
  file: SourceFile,
  files: readonly SourceFile[],
  hops: number,
): { fn: Fn; file: SourceFile } | undefined {
  if (hops > MAX_DEPTH) return undefined;
  for (const st of parseFile(file).program.body) {
    const d = st.type === "ExportNamedDeclaration" || st.type === "ExportDefaultDeclaration" ? st.declaration : st;
    if (d?.type === "FunctionDeclaration" && d.id?.name === name && d.body !== null) return { fn: d, file };
    if (d?.type === "VariableDeclaration" && d.kind === "const")
      for (const v of d.declarations) {
        const init = v.init === null || v.init === undefined ? undefined : unwrap(v.init);
        if (v.id.type === "Identifier" && v.id.name === name)
          return init?.type === "ArrowFunctionExpression" || init?.type === "FunctionExpression"
            ? { fn: init, file }
            : undefined;
      }
    if (st.type === "ImportDeclaration")
      for (const sp of st.specifiers)
        if (sp.local.name === name && sp.type === "ImportSpecifier") {
          const target = importTarget(file.path, st.source.value, files);
          const imported = sp.imported.type === "Identifier" ? sp.imported.name : sp.imported.value;
          return target === undefined ? undefined : exportedFunction(imported, target, files, hops + 1);
        }
  }
  return undefined;
}

/** The function `file` exports as `name`: declared there, a local exported under it, a re-export or `export *`. */
function exportedFunction(
  name: string,
  file: SourceFile,
  files: readonly SourceFile[],
  hops: number,
): { fn: Fn; file: SourceFile } | undefined {
  if (hops > MAX_DEPTH) return undefined;
  for (const st of parseFile(file).program.body) {
    if (st.type === "ExportNamedDeclaration" && st.declaration !== null && st.declaration !== undefined) {
      const hit = localFunction(name, file, files, hops + 1);
      const d = st.declaration;
      const declares =
        (d.type === "FunctionDeclaration" && d.id?.name === name) ||
        (d.type === "VariableDeclaration" &&
          d.declarations.some((v) => v.id.type === "Identifier" && v.id.name === name));
      if (declares) return hit;
    } else if (st.type === "ExportNamedDeclaration")
      for (const sp of st.specifiers) {
        const exported = sp.exported.type === "Identifier" ? sp.exported.name : sp.exported.value;
        const local = sp.local.type === "Identifier" ? sp.local.name : sp.local.value;
        if (exported !== name) continue;
        if (st.source === null) return localFunction(local, file, files, hops + 1);
        const target = importTarget(file.path, st.source.value, files);
        return target === undefined ? undefined : exportedFunction(local, target, files, hops + 1);
      }
    else if (st.type === "ExportAllDeclaration" && st.exported === null) {
      const target = importTarget(file.path, st.source.value, files);
      const hit = target === undefined ? undefined : exportedFunction(name, target, files, hops + 1);
      if (hit !== undefined) return hit;
    }
  }
  return undefined;
}

/** The expressions `fn` of `file` returns (none of a nested function's); `null` for a bare `return`. */
function returned(fn: Fn, file: SourceFile): (Expression | null)[] {
  if (fn.type === "ArrowFunctionExpression" && fn.expression && fn.body.type !== "BlockStatement") return [fn.body];
  const body = fn.body;
  if (body === null) return [];
  const nested: { start: number; end: number }[] = [];
  const out: { at: number; arg: Expression | null }[] = [];
  const inner = (n: { start: number; end: number }): void => {
    if (n.start > body.start && n.end <= body.end) nested.push(n);
  };
  new Visitor({
    FunctionDeclaration: inner,
    FunctionExpression: inner,
    ArrowFunctionExpression: inner,
    ReturnStatement: (r) => {
      if (r.start >= body.start && r.end <= body.end) out.push({ at: r.start, arg: r.argument });
    },
  }).visit(parseFile(file).program);
  return out.filter((r) => !nested.some((n) => r.at > n.start && r.at < n.end)).map((r) => r.arg);
}

/** What the call of package function `fn` (in `file` of `files`) returns, its parameters read at the call. */
function readFunction(
  fn: Fn,
  file: SourceFile,
  files: readonly SourceFile[],
  q: SchemaQuestion,
  seen: Set<string>,
  ctx: Ctx,
): SchemaAnswer {
  // A function met again while its read is open (direct or mutual recursion) never finishes here: unknown.
  const id = `${file.path}:${fn.start}`;
  if (ctx.active.has(id)) return "unknown";
  const params = new Set<string>();
  const defaults: unknown[] = [];
  for (const p of fn.params satisfies ParamPattern[]) bound(p, params, defaults);
  const locals = new Map<string, Expression>();
  if (fn.body !== null && fn.body.type === "BlockStatement")
    for (const st of fn.body.body)
      if (st.type === "VariableDeclaration" && st.kind === "const")
        for (const v of st.declarations)
          if (v.id.type === "Identifier" && v.init !== null && v.init !== undefined) locals.set(v.id.name, v.init);
  const scope: Scope = { params, locals };
  const inner: Ctx = { app: ctx.app, scope, depth: ctx.depth + 1, active: new Set([...ctx.active, id]) };
  const read = (x: Expression | null): SchemaAnswer => (x === null ? "no" : readIn(x, file, files, q, seen, inner));
  const fromDefaults = fn.params.flatMap((p) => (p.type === "AssignmentPattern" ? [read(p.right)] : []));
  return [...returned(fn, file).map(read), ...fromDefaults].reduce(worst, "no");
}

/**
 * The call `e` of `file` of an export of a package whose source the reader resolves to (k.privacy-reads Factories):
 * its arguments read at the call, and what the function returns read in the package's own files; `undefined` when
 * the callee is no such export.
 */
function packageCall(
  e: CallExpression,
  file: SourceFile,
  files: readonly SourceFile[],
  q: SchemaQuestion,
  seen: Set<string>,
  ctx: Ctx,
): SchemaAnswer | undefined {
  const c = e.callee;
  let target: { readonly package: string; readonly name: string } | undefined;
  if (c.type === "MemberExpression") {
    if (c.computed) return undefined;
    const ns = followRef(c.object, file, files);
    if (ns !== null && ns !== "global" && "package" in ns && ns.name === "*")
      target = { package: ns.package, name: c.property.name };
  } else if (c.type !== "Super") {
    const at = followRef(c, file, files);
    if (at !== null && at !== "global" && "package" in at) target = at;
  }
  if (target === undefined || target.package === SCHEMA) return undefined;
  const args = e.arguments.map((a) => readIn(a, file, files, q, seen, ctx)).reduce(worst, "no");
  const pkg = ctx.depth < MAX_DEPTH ? packageSource(target.package, file, ctx.app) : undefined;
  const fn = pkg === undefined ? undefined : exportedFunction(target.name, pkg.entry, pkg.files, 0);
  const body =
    pkg === undefined || fn === undefined ? "unknown" : readFunction(fn.fn, fn.file, pkg.files, q, seen, ctx);
  if (body === "unknown") q.unread?.(e, file);
  return worst(args, body);
}

/**
 * A package function's own helper called inside it (`textFormat` in `line`): what it returns, read in the package's
 * files; `undefined` outside a package function or for a callee that is no such function.
 */
function helperCall(
  e: CallExpression,
  file: SourceFile,
  files: readonly SourceFile[],
  q: SchemaQuestion,
  seen: Set<string>,
  ctx: Ctx,
): SchemaAnswer | undefined {
  if (ctx.scope === undefined || e.callee.type !== "Identifier" || ctx.depth >= MAX_DEPTH) return undefined;
  if (ctx.scope.params.has(e.callee.name) || ctx.scope.locals.has(e.callee.name)) return undefined;
  const fn = localFunction(e.callee.name, file, files, 0);
  if (fn === undefined) return undefined;
  const args = e.arguments.map((a) => readIn(a, file, files, q, seen, ctx)).reduce(worst, "no");
  return worst(args, readFunction(fn.fn, fn.file, files, q, seen, ctx));
}

function readIn(
  expr: Argument,
  file: SourceFile,
  files: readonly SourceFile[],
  q: SchemaQuestion,
  seen: Set<string>,
  ctx: Ctx,
): SchemaAnswer {
  if (expr.type === "SpreadElement") return readIn(expr.argument, file, files, q, seen, ctx);
  const lost = (part: Argument, in_: SourceFile): SchemaAnswer => {
    q.unread?.(part, in_);
    return "unknown";
  };
  const plain = unwrap(expr);
  if (plain.type === "Identifier" && ctx.scope !== undefined) {
    if (ctx.scope.params.has(plain.name)) return "no";
    const local = ctx.scope.locals.get(plain.name);
    if (local !== undefined) return readIn(local, file, files, q, seen, ctx);
  }
  const at = followRef(expr, file, files);
  if (at === "global") return q.global;
  if (at === null) return lost(expr, file);
  if ("package" in at) return q.pkg(at);
  const key = `${at.file.path}:${at.expr.start}:${at.expr.end}`;
  if (seen.has(key)) return "no";
  seen.add(key);
  const e = at.expr;
  if (!held(e, at.file, files)) return lost(e, at.file);
  const sub = (x: Argument | null): SchemaAnswer => (x === null ? "no" : readIn(x, at.file, files, q, seen, ctx));
  switch (e.type) {
    case "CallExpression": {
      const own = q.call?.(e, at.file, sub);
      if (own !== undefined) return own;
      const factory = packageCall(e, at.file, files, q, seen, ctx) ?? helperCall(e, at.file, files, q, seen, ctx);
      if (factory !== undefined) return factory;
      const c = e.callee;
      if (c.type !== "MemberExpression" || c.computed) return lost(e, at.file);
      // `s.object(...)` reads `s` from a package; `X.optional()` reads `X`.
      return e.arguments.map(sub).reduce(worst, sub(c.object));
    }
    case "ObjectExpression":
      // A getter, setter or method runs code to give its field, so its schema cannot be read statically.
      return e.properties
        .map(
          (p): SchemaAnswer =>
            p.type !== "Property" ? sub(p) : p.kind !== "init" || p.method ? lost(e, at.file) : sub(p.value),
        )
        .reduce(worst, "no");
    case "ArrayExpression":
      return e.elements.map((x) => (x === null ? "no" : sub(x))).reduce(worst, "no");
    case "ConditionalExpression":
      return worst(sub(e.consequent), sub(e.alternate));
    case "LogicalExpression":
      return worst(sub(e.left), sub(e.right));
    case "MemberExpression":
      return e.computed ? lost(e, at.file) : sub(e.object);
    case "Literal":
    case "TemplateLiteral":
    case "ArrowFunctionExpression":
    case "FunctionExpression":
    case "UnaryExpression":
    case "BinaryExpression":
      return "no";
    default:
      return lost(e, at.file);
  }
}

/**
 * The schema walk E1111, E1107 and `schemaHolds` share (k.privacy-reads Readers): `expr` in `file` read through
 * `const`s, project imports and re-exports, namespace members, object literal fields, spreads, array elements, call
 * arguments, a call's receiver (`X.optional()` reads `X`), both branches of `?:` and both sides of `&&`, `||` and
 * `??`, each part asked `q`. A call of a package's export whose source the reader resolves to (k.privacy-reads
 * Factories; `@keel/schema`'s own constructors aside) reads its arguments at the call and what the function returns
 * in the package's files, its parameters standing for the arguments, its body's `const`s and the package's own
 * helpers followed. `yes` when a part answers `yes`; else `unknown` when a part cannot be read: any other call whose
 * callee is not a member (a project function, a package with no source), a binding it cannot follow (a parameter or
 * a local of app code among them), a computed member, an object literal's getter, setter or method, or a literal
 * binding that is not held (`held`, k.privacy-reads Held); else `no`. A part reached twice answers `no` the second
 * time. `project`'s root (`projectRoots`) is where a package specifier is resolved from.
 */
export function schemaRead(
  expr: Argument,
  file: SourceFile,
  project: readonly SourceFile[],
  q: SchemaQuestion,
  seen: Set<string> = new Set(),
): SchemaAnswer {
  return readIn(expr, file, project, q, seen, { app: project, scope: undefined, depth: 0, active: new Set() });
}
