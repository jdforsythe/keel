import type { Argument, CallExpression, Expression, ParamPattern } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import type { ReadPackage } from "./ReadPackage.ts";
import type { SchemaAnswer } from "./SchemaAnswer.ts";
import type { SchemaQuestion } from "./SchemaQuestion.ts";
import { followRef } from "./followRef.ts";
import { READ_DEPTH } from "./functionRead/READ_DEPTH.ts";
import type { ReadFn } from "./functionRead/ReadFn.ts";
import { bound } from "./functionRead/bound.ts";
import { exportedFunction } from "./functionRead/exportedFunction.ts";
import { fileOfIn } from "./functionRead/fileOfIn.ts";
import { fnKey } from "./functionRead/fnKey.ts";
import { localFunction } from "./functionRead/localFunction.ts";
import { returned } from "./functionRead/returned.ts";
import { held } from "./held.ts";
import { packageSource } from "./packageSource.ts";
import { parseFile } from "./parseFile.ts";
import { projectLibraries } from "./projectLibraries.ts";

/** The package whose exports are the schema constructors themselves, read by their receiver and arguments. */
const SCHEMA = "@keel/schema";

/** Inside a package function: its parameters (read at the call), its body's top-level `const`s, the depth. */
type Scope = { readonly params: ReadonlySet<string>; readonly locals: ReadonlyMap<string, Expression> };
/** `active`: the package functions being read on the way here, so a cycle among them is not read as finished. */
type Ctx = {
  readonly app: readonly SourceFile[];
  /** The app's libraries' `exports` entries to the files they give among `app` (k.library In an app). */
  readonly entries: ReadonlyMap<string, string>;
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

/**
 * A library the app lists (k.library In an app) is read from the project's own read of its files, where reach finds
 * them (`reachResolve`): the file its `exports` entry `spec` gives, and the app's files, its own among them.
 */
function listedLibrary(spec: string, ctx: Ctx): ReadPackage | undefined {
  const at = ctx.entries.get(spec);
  const entry = at === undefined ? undefined : ctx.app.find((f) => f.path === at);
  return entry === undefined ? undefined : { entry, files: ctx.app, entries: ctx.entries };
}

/** What the call of package function `fn` (in `file` of `files`) returns, its parameters read at the call. */
function readFunction(
  fn: ReadFn,
  file: SourceFile,
  files: readonly SourceFile[],
  q: SchemaQuestion,
  seen: Set<string>,
  ctx: Ctx,
): SchemaAnswer {
  // A function met again while its read is open (direct or mutual recursion) never finishes here: unknown.
  const id = fnKey(file, fn);
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
  const inner: Ctx = {
    app: ctx.app,
    entries: ctx.entries,
    scope,
    depth: ctx.depth + 1,
    active: new Set([...ctx.active, id]),
  };
  const read = (x: Expression | null): SchemaAnswer => (x === null ? "no" : readIn(x, file, files, q, seen, inner));
  const fromDefaults = fn.params.flatMap((p) => (p.type === "AssignmentPattern" ? [read(p.right)] : []));
  return [...returned(fn, parseFile(file).program).map(read), ...fromDefaults].reduce(worst, "no");
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
  const pkg =
    ctx.depth < READ_DEPTH
      ? (listedLibrary(target.package, ctx) ?? packageSource(target.package, file, ctx.app))
      : undefined;
  const fn = pkg === undefined ? undefined : exportedFunction(target.name, pkg.entry, fileOfIn(pkg.files, pkg.entries));
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
  if (ctx.scope === undefined || e.callee.type !== "Identifier" || ctx.depth >= READ_DEPTH) return undefined;
  if (ctx.scope.params.has(e.callee.name) || ctx.scope.locals.has(e.callee.name)) return undefined;
  const fn = localFunction(e.callee.name, file, fileOfIn(files, ctx.entries));
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
  const entries = projectLibraries.get(project)?.entries ?? new Map<string, string>();
  return readIn(expr, file, project, q, seen, { app: project, entries, scope: undefined, depth: 0, active: new Set() });
}
